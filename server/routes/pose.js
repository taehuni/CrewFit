import express from 'express';
import {createPoseClassifier} from '../services/poseClassification.js';
import {createPoseVideos, MAX_VIDEO_BYTES} from '../services/poseVideos.js';
import {createGymFeedback} from '../services/gymFeedback.js';

export function createPoseRouter(auth, {classify = createPoseClassifier(), videos = createPoseVideos(), feedback = createGymFeedback()} = {}) {
  const router = express.Router();
  const uploads = new Set();
  const videoError = (res,error) => {
    const known = [400,401,404,409,410,429,503].includes(error.status);
    res.status(known ? error.status : 503).json({error:{code:known ? error.code : 'video_unavailable',message:known ? error.message : '영상을 처리하지 못했어요. 측정 결과는 그대로 유지돼요.'}});
  };
  const videoAuth = (req,res,next) => {
    res.set('Cache-Control','no-store');
    if (!req.user?.id) return res.status(401).json({error:{code:'unauthorized',message:'로그인 후 이용해 주세요.'}});
    next();
  };
  router.put('/sessions/:id/video',auth,videoAuth,async (req,res,next) => {
    if (uploads.size >= 4 || uploads.has(req.user.id)) return res.status(429).json({error:{code:'upload_busy',message:'진행 중인 영상 보관이 끝난 뒤 다시 시도해 주세요.'}});
    uploads.add(req.user.id);
    const release = () => uploads.delete(req.user.id);
    res.once('close',release);
    try {await videos.checkSession(req.db,req.user.id,req.params.id); next();}
    catch(error) {videoError(res,error);}
  },express.raw({type:() => true,limit:MAX_VIDEO_BYTES,inflate:false}),async (req,res) => {
    try {res.json(await videos.put(req.db,req.user.id,req.params.id,req.body,req.get('content-type'),req.get('x-video-duration-seconds')));}
    catch(error) {videoError(res,error);}
  });
  router.get('/sessions/:id/video',auth,videoAuth,async (req,res) => {
    try {res.json(await videos.get(req.db,req.user.id,req.params.id));}
    catch(error) {videoError(res,error);}
  });
  router.delete('/sessions/:id/video',auth,videoAuth,async (req,res) => {
    try {await videos.remove(req.db,req.user.id,req.params.id); res.status(204).end();}
    catch(error) {videoError(res,error);}
  });
  // Authenticate before accepting the larger photo payload; mount before global JSON parser.
  router.post('/classify', auth, express.json({limit: '1mb', inflate: false}), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!req.user?.id) return res.status(401).json({error: {code: 'unauthorized', message: '로그인 후 이용해 주세요.'}});
    try {res.json(await classify(req.user.id, req.body));}
    catch (error) {
      const known = [400, 429, 502, 503].includes(error.status);
      res.status(known ? error.status : 502).json({error: {code: known ? error.code : 'classification_failed', message: known ? error.message : '운동을 인식하지 못했어요. 잠시 후 다시 시도해 주세요.'}});
    }
  });
  router.post('/feedback',auth,express.json({limit:'1mb',inflate:false}),async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(!req.user?.id)return res.status(401).json({error:{code:'unauthorized',message:'로그인 후 이용해 주세요.'}});
    try {res.json(await feedback(req.user.id,req.body));}
    catch(error){const known=[400,429,502,503].includes(error.status);res.status(known?error.status:502).json({error:{code:known?error.code:'feedback_failed',message:known?error.message:'이번 구간을 확인하지 못했어요. 측정과 기록은 계속할 수 있어요.'}});}
  });
  router.use((error, req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({error: {code: 'invalid_payload', message: '파일 요청 형식이나 크기를 확인해 주세요.'}});
  });
  return router;
}
