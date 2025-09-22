// id生成
const nanoid = (() => {
  const SERVICE_ID = Math.floor(Math.random() * 36 ** 2);

  let lastMs = 0;
  let counter = 0;

  return (withService) => {
    const now = Date.now();

    if (now === lastMs) {
      counter++;
    } else {
      lastMs = now;
      counter = 0;
    }

    return (
      'h' +
      now.toString(36) +
      (withService ? SERVICE_ID.toString(36).padStart(2, '0') : '') +
      (counter > 0 ? counter.toString(36) : '')
    );
  };
})();

export default nanoid;
