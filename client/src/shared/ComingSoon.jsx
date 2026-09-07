import { Empty } from './ui.jsx';

// 아직 안 만든 탭의 자리. 기능이 들어오면 라우트에서 교체하고 이 컴포넌트 사용처는 사라짐.
export default function ComingSoon({ title, step }) {
  return (
    <>
      <div className="page-head"><h1>{title}</h1></div>
      <Empty title="준비 중이에요">구현 {step} 단계에서 들어와요.</Empty>
    </>
  );
}
