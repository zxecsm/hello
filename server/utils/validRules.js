// --------------------- Validator 基类 ---------------------
class Validator {
  constructor() {
    this.rules = [];
    this._default = undefined;
    this._preprocess = [];
    this._transforms = [];
  }

  default(v) {
    this._default = v;
    return this;
  }

  transform(fn) {
    this._transforms.push(fn);
    return this;
  }

  preprocess(fn) {
    this._preprocess.push(fn);
    return this;
  }

  custom(fn, msg = '自定义规则验证失败') {
    return this._addRule(fn, msg);
  }

  _addRule(fn, msg) {
    this.rules.push({ fn, msg });
    return this;
  }

  async _applyTransforms(value) {
    for (const fn of this._transforms) {
      value = await fn(value);
    }
    return value;
  }

  async _applyPreprocess(value) {
    for (const fn of this._preprocess) {
      value = await fn(value);
    }
    return value;
  }

  enum(arr) {
    const set = new Set(arr);
    return this._addRule((v) => set.has(v), `必须为其中之一: ${arr.join(', ')}`);
  }

  notEnum(arr) {
    const set = new Set(arr);
    return this._addRule((v) => !set.has(v), `不能为其中之一: ${arr.join(', ')}`);
  }

  not(v) {
    return this._addRule((val) => val !== v, `不能为: ${v}`);
  }

  equal(v) {
    return this._addRule((val) => val === v, `必须为： ${v}`);
  }

  async _run(value, path) {
    // 预处理
    value = await this._applyPreprocess(value);

    // 默认值
    if (value === undefined) {
      if (this._default !== undefined) {
        value = this._default;
      } else {
        return { ok: false, error: `${path} 是必须的` };
      }
    }

    // 执行规则
    for (const rule of this.rules) {
      if (!rule.fn(value)) return { ok: false, error: `${path} ${rule.msg}` };
    }

    // 执行转换
    value = await this._applyTransforms(value);

    return { ok: true, value };
  }
}

// --------------------- 基础类型 ---------------------
class VString extends Validator {
  constructor() {
    super();
    this.allowEmptyValue = false;
    this._addRule((v) => typeof v === 'string', '必须是字符串');
  }
  _canBeEmpty(v) {
    return this.allowEmptyValue && v === '';
  }
  allowEmpty() {
    this.allowEmptyValue = true;
    return this;
  }
  notEmpty() {
    this.allowEmptyValue = false;
    return this._addRule((v) => {
      if (this._canBeEmpty(v)) return true;
      return v.trim() !== '';
    }, '不能为空字符');
  }
  min(n) {
    return this._addRule((v) => {
      if (this._canBeEmpty(v)) return true;
      return v.length >= n;
    }, `长度不能小于 ${n}`);
  }
  max(n) {
    return this._addRule((v) => {
      if (this._canBeEmpty(v)) return true;
      return v.length <= n;
    }, `长度不能大于 ${n}`);
  }
  email() {
    return this.pattern(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      '不是合规的 email 地址',
    );
  }
  trim() {
    return this.preprocess((v) => {
      if (typeof v === 'string') return v.trim();
      return v;
    });
  }
  alphanumeric() {
    return this._addRule((v) => {
      if (this._canBeEmpty(v)) return true;
      return /^[a-zA-Z0-9_]+$/.test(v);
    }, '必须是字母数字下划线组成');
  }
  pattern(re, msg = '正则表达式不匹配') {
    return this._addRule((v) => {
      if (this._canBeEmpty(v)) return true;
      return re.test(v);
    }, msg);
  }
  enum(arr) {
    const set = new Set(arr);
    return this._addRule(
      (v) => {
        if (this._canBeEmpty(v)) return true;
        return set.has(v);
      },
      `必须为其中之一: ${arr.join(', ')}`,
    );
  }
  notEnum(arr) {
    const set = new Set(arr);
    return this._addRule(
      (v) => {
        if (this._canBeEmpty(v)) return true;
        return !set.has(v);
      },
      `不能为其中之一: ${arr.join(', ')}`,
    );
  }
  not(v) {
    return this._addRule((val) => {
      if (this._canBeEmpty(val)) return true;
      return val !== v;
    }, `不能为: ${v}`);
  }
  equal(v) {
    return this._addRule((val) => {
      if (this._canBeEmpty(val)) return true;
      return val === v;
    }, `必须为： ${v}`);
  }
  url() {
    return this._addRule((v) => {
      if (this._canBeEmpty(v)) return true;
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }, '不是有效的 url');
  }
  httpUrl() {
    return this._addRule((v) => {
      if (this._canBeEmpty(v)) return true;
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    }, '不是有效的 http url');
  }
}

class VNumber extends Validator {
  constructor() {
    super();
    this._addRule((v) => typeof v === 'number' && !isNaN(v), '必须是数值');
  }
  min(n) {
    return this._addRule((v) => v >= n, `>= ${n}`);
  }
  max(n) {
    return this._addRule((v) => v <= n, `<= ${n}`);
  }
  int() {
    return this._addRule((v) => Number.isInteger(v), '必须是整数');
  }
  toInt() {
    return this.preprocess((v) => {
      if (v === undefined) return v;
      if (typeof v === 'string' && v.trim() === '') return 0;
      const res = parseInt(v);
      return isNaN(res) ? v : res;
    });
  }
  toNumber() {
    return this.preprocess((v) => {
      if (v === undefined) return v;
      if (typeof v === 'string' && v.trim() === '') return 0;
      const res = parseFloat(v);
      return isNaN(res) ? v : res;
    });
  }
}

class VBoolean extends Validator {
  constructor() {
    super();
    this._addRule((v) => typeof v === 'boolean', '必须是布尔值');
  }
}

// --------------------- Array 验证 ---------------------
class VArray extends Validator {
  constructor(itemSchema) {
    super();
    this.itemSchema = itemSchema;
    this._addRule((v) => Array.isArray(v), '必须是数组');
  }

  min(n) {
    return this._addRule((v) => v.length >= n, `length >= ${n}`);
  }
  max(n) {
    return this._addRule((v) => v.length <= n, `length <= ${n}`);
  }

  async _run(value, path) {
    const base = await super._run(value, path);
    if (!base.ok || base.value === undefined) return base;

    if (this.itemSchema === undefined) return { ok: true, value: base.value };

    const arr = base.value;
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const newPath = path ? `${path}[${i}]` : `${i}`;
      const r = await this.itemSchema._run(arr[i], newPath);
      if (!r.ok) return r;
      out.push(r.value);
    }
    return { ok: true, value: out };
  }
}

// --------------------- Object 验证 ---------------------
class VObject extends Validator {
  constructor(shape) {
    super();
    this.shape = shape;
    this._addRule((v) => typeof v === 'object' && v !== null && !Array.isArray(v), '必须是对象');
  }

  async _run(value, path) {
    const base = await super._run(value, path);
    if (!base.ok || base.value === undefined) return base;

    if (this.shape === undefined) return { ok: true, value: base.value };

    const obj = base.value;
    const out = {};
    for (const key in this.shape) {
      const newPath = path ? `${path}.${key}` : key;
      const r = await this.shape[key]._run(obj[key], newPath);
      if (!r.ok) return r;
      out[key] = r.value;
    }
    return { ok: true, value: out };
  }
}

// ---------------------  命名空间 ---------------------
const V = {
  string: () => new VString(),
  number: () => new VNumber(),
  boolean: () => new VBoolean(),
  array: (s) => new VArray(s),
  object: (s) => new VObject(s),
  async parse(data, schema, path = '') {
    const r = await schema._run(data, path);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  },
};

export default V;
