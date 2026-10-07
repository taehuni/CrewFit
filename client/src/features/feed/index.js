import { lazy } from 'react';
export { default as CrewFeed } from './FeedPage.jsx';
export const FeedPage=lazy(()=>import('./FeedPage.jsx'));
export const PostEditor=lazy(()=>import('./PostEditor.jsx'));
export const PostDetail=lazy(()=>import('./PostDetail.jsx'));
