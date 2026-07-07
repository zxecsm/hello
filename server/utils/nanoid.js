// id生成
const nanoid = (() => {
  const to36 = (num) => num.toString(36).padStart(2, '0');
  const SERVICE_ID = to36(Math.floor(Math.random() * 1296)); // 36**2 = 1296

  let lastMs = 0,
    counter = 0;

  return () => {
    const now = Date.now();
    counter = now === lastMs ? counter + 1 : ((lastMs = now), 0);

    return `h${now.toString(36)}${SERVICE_ID}${to36(counter)}${to36(Math.floor(Math.random() * 1296))}`.toUpperCase();
  };
})();

export default nanoid;
