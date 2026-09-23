import { Link } from 'react-router';
import './record-tabs.css';

export default function RecordTabs({ active }) {
  return <nav className="record-tabs" aria-label="기록 종류">
    <Link to="/activities" aria-current={active === 'activities' ? 'page' : undefined}>운동</Link>
    <Link to="/meals" aria-current={active === 'meals' ? 'page' : undefined}>식단</Link>
  </nav>;
}
