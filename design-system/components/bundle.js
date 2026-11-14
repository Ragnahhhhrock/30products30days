/* @ds-bundle: {"format":4,"namespace":"Launch30","components":[{"name":"Button"},{"name":"Tag"},{"name":"DayBadge"},{"name":"ProductCard"},{"name":"ProgressBar"}]} */
(function () {
  var h = window.React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }

  function Button(props) {
    var variant = props.variant || 'primary';
    var cls = cx('l30-btn', 'l30-btn--' + variant, props.className);
    if (props.href) return h('a', { className: cls, href: props.href }, props.children);
    return h('button', { className: cls, type: props.type || 'button', onClick: props.onClick, disabled: props.disabled }, props.children);
  }

  var TAG_LABELS = { shipped: 'Shipped', building: 'Building', planned: 'Coming up' };
  function Tag(props) {
    var status = props.status || 'planned';
    return h('span', { className: cx('l30-tag', 'l30-tag--' + status, props.className) }, props.children || TAG_LABELS[status]);
  }

  var STAR = 'M100 6 L104 18 L116 22 L104 26 L100 38 L96 26 L84 22 L96 18 Z';
  function DayBadge(props) {
    var size = props.size || 96;
    var day = String(props.day == null ? 30 : props.day);
    if (day.length < 2) day = '0' + day;
    return h('svg', { className: cx('l30-badge', props.className), width: size, height: size, viewBox: '0 0 120 120', role: 'img', 'aria-label': 'Day ' + day },
      h('circle', { cx: 54, cy: 58, r: 46, fill: 'var(--outline)' }),
      h('circle', { cx: 48, cy: 52, r: 46, fill: 'var(--brand-launch)', stroke: 'var(--outline)', strokeWidth: 5 }),
      h('text', { x: 48, y: 68, textAnchor: 'middle', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 50, letterSpacing: -3, fill: '#0F1B3D' }, day),
      h('path', { d: STAR, fill: 'var(--brand-flamingo)', stroke: '#0F1B3D', strokeWidth: 3, strokeLinejoin: 'round' })
    );
  }

  function ProductCard(props) {
    return h('article', { className: cx('l30-card', props.className) },
      h('header', { className: 'l30-card__head' },
        h('span', { className: 'l30-card__day' }, 'Day ' + (props.day < 10 ? '0' : '') + props.day),
        h('span', { className: 'l30-card__type' }, props.type || 'Digital')),
      h('div', { className: 'l30-card__body' },
        h('h3', { className: 'l30-card__title' }, props.title),
        h('p', { className: 'l30-card__text' }, props.description),
        h('div', { className: 'l30-card__foot' },
          h('b', { className: 'l30-card__price' }, props.price),
          h(Button, { href: props.href || '#' }, props.cta || 'Grab it'))));
  }

  function ProgressBar(props) {
    var total = props.total || 30, done = Math.max(0, Math.min(props.done || 0, total));
    return h('div', { className: cx('l30-progress', props.className) },
      h('div', { className: 'l30-progress__label' }, done + ' OF ' + total + ' SHIPPED'),
      h('div', { className: 'l30-progress__track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done },
        h('div', { className: 'l30-progress__fill', style: { width: (done / total * 100) + '%' } })));
  }

  window.Launch30 = { Button: Button, Tag: Tag, DayBadge: DayBadge, ProductCard: ProductCard, ProgressBar: ProgressBar };
})();
