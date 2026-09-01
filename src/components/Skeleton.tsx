/** What the kiosk shows while the catalogue is being read out of IndexedDB.
 *
 *  The shape is Home's, not a generic box: kicker, heading, the invitation
 *  panel, the category row, then the grid. A tablet woken from sleep spends a
 *  moment here, and a customer who can already see where the pieces will be
 *  waits; one looking at a spinner in the middle of an empty screen does not.
 *  Because the shapes match, nothing moves when the real screen replaces it. */
export function HomeSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading the collection">
      <div className="skel skel--kicker" />
      <div className="stack" style={{ gap: 10 }}>
        <div className="skel skel--title" />
        <div className="skel skel--title2" />
      </div>

      <div className="skel skel--panel" />

      <div className="hstack" style={{ gap: 8, overflow: 'hidden' }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel skel--chip" />)}
      </div>

      <div className="grid2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stack" style={{ gap: 9 }}>
            <div className="skel skel--tile" />
            <div className="skel skel--line" />
            <div className="skel skel--line-s" />
          </div>
        ))}
      </div>
    </div>
  );
}
