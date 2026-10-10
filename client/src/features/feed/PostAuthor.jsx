import { Link } from 'react-router';
import {MemberAvatar} from '../../shared/CommunityMedia.jsx';

export default function PostAuthor({authorId,nickname='회원',createdAt,visibility,comment=false,isAuthor=false}) {
  return <div className={`post-author${comment?' post-author-comment':''}`}>
    <MemberAvatar id={authorId} name={nickname}/>
    <div className="post-author-info">
      <div className="post-author-name"><Link to={`/users/${authorId}`}>{nickname}</Link>{isAuthor ? <span className="post-author-label">글 작성자</span>:!comment&&<span className="person-role-label">작성자</span>}</div>
      <p className="post-author-meta"><time dateTime={createdAt}>{new Date(createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>{visibility && <span> · {visibility==='crew'?'크루 전용':'전체 공개'}</span>}{comment && <span> · 댓글</span>}</p>
    </div>
  </div>;
}
