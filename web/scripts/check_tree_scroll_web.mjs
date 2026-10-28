import { promises as fs } from 'node:fs';
import { seedTree, readTree, verifyTreeActions } from './check_tree_scroll.mjs';

// ego-browser nodejs -e "await import('file:///.../web/scripts/check_tree_scroll_web.mjs')"
const task = await taskSpace('NowNote Stage A regression');
const page = task.page('p1');
const out = 'D:/tmp/now-240-stage-a';
await fs.mkdir(out, { recursive: true });
try {
  await page.goto(new URL('../index.html', import.meta.url).href);
  const ids = await page.evaluate(`(${seedTree.toString()})()`);
  for (let n = 0; n < 30; n++) {
    const id = n % 3 === 2 ? ids.next : ids.target;
    const before = await page.evaluate(`(${readTree.toString()})()`);
    await page.click(`[data-node-id="${id}"] > .tree-row .tree-label-btn`);
    const after = await page.evaluate(`(${readTree.toString()})()`);
    if (Math.abs(before.top - after.top) > 2 || after.selected !== id) {
      throw new Error(JSON.stringify({ before, after, id }));
    }
  }
  const checks = await verifyTreeActions(source => page.evaluate(source), selector => page.click(selector));
  await page.screenshot({ path: `${out}/web-after.png` });
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 520, height: 800, deviceScaleFactor: 1, mobile: false });
  const overlap = await page.evaluate(() => [...document.querySelectorAll('.tree-row')].some(row => {
    const label = row.querySelector('.tree-label-btn').getBoundingClientRect();
    const add = row.querySelector('.small-btn').getBoundingClientRect();
    return add.width > 0 && label.right > add.left;
  }));
  if (overlap) throw new Error('Narrow tree buttons overlap');
  await page.screenshot({ path: `${out}/web-narrow.png` });
  await fs.writeFile(`${out}/web-regression.json`, JSON.stringify({ clicks: 30, narrowOverlap: overlap, ...checks }, null, 2));
  console.log({ clicks: 30, narrowOverlap: overlap, ...checks });
} finally {
  await task.finish({ keep: [] });
}
