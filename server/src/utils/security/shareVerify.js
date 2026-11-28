import verifyLimit from './verifyLimit.js';

const shareVerify = verifyLimit({ space: 60 * 30, name: 'shareVerify' });
export default shareVerify;
