/** Join class names, ignoring falsy values: cn('a', cond && 'b', ['c', null]) → "a b c" */
export function cn(...args) {
  const out = [];
  for (const a of args.flat(Infinity)) {
    if (a) out.push(a);
  }
  return out.join(' ');
}
