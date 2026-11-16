// Pick a pane in the requested direction, favoring panes that share an edge.
function adjacentPane(rects, activeId, direction) {
  const source = rects.find(r => r.id === activeId); if (!source) return null;
  const horizontal = direction === 'left' || direction === 'right';
  const forward = direction === 'right' || direction === 'down';
  const center = r => horizontal ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2;
  const perpendicular = r => horizontal ? [r.top, r.bottom] : [r.left, r.right];
  const [s0, s1] = perpendicular(source);
  return rects.filter(r => r.id !== activeId && (horizontal ? (forward ? r.left >= source.right - 1 : r.right <= source.left + 1) : (forward ? r.top >= source.bottom - 1 : r.bottom <= source.top + 1))).map(r => {
    const [a, b] = perpendicular(r), overlap = Math.min(b, s1) - Math.max(a, s0);
    return { id: r.id, aligned: overlap > 0, distance: Math.abs(center(r) - center(source)), offset: Math.abs((a + b - s0 - s1) / 2) };
  }).sort((a, b) => Number(b.aligned) - Number(a.aligned) || a.distance - b.distance || a.offset - b.offset)[0]?.id || null;
}
module.exports = { adjacentPane };
