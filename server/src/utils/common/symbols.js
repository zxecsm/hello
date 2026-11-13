const _symbols = Object.create(null);

export function sym(name) {
  return (_symbols[name] ||= Symbol(name));
}
