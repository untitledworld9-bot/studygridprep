/* cert-core.js — shared by certificate.html and hiring-admin.html
   Certificate data + duration rules. Same logic everywhere, one source of truth. */
export const SGP = {
  org: 'Study Grid Prep',
  publicBase: 'https://studygridprep.online/',
  signatory: { name: 'Ayush Gupta', title: 'Founder, Study Grid Prep' },   // ← change here
  minDays: 15,                                                              // below this → no certificate
};
export const EMP_LABELS = { FULL_TIME:'Full-time', PART_TIME:'Part-time', INTERN:'Internship', CONTRACTOR:'Contract / Freelance', VOLUNTEER:'Volunteer', OTHER:'Flexible' };

export function toMs(v){
  if (!v) return null;
  if (v.toDate) return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const d = new Date(v); return isNaN(d.getTime()) ? null : d.getTime();
}
const addM = (ms, n) => { const d = new Date(ms); d.setMonth(d.getMonth() + n); return d.getTime(); };

/* Rounding rules:
   full months + leftover days →
   leftover < 15 days  → just the full months
   leftover ≥ 15 days  → +0.5 month
   leftover within 2 days of the next month → next full month
   total < 15 days     → not eligible */
export function certDuration(startMs, endMs){
  const s = new Date(startMs), e = new Date(endMs);
  let m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  let anchor = addM(startMs, m);
  if (anchor > endMs) { m--; anchor = addM(startMs, m); }
  const rem = Math.floor((endMs - anchor) / 864e5);
  const monthDays = Math.round((addM(anchor, 1) - anchor) / 864e5);
  let months = m;
  if (monthDays - rem <= 2) months = m + 1;
  else if (rem >= 15) months = m + 0.5;
  const days = Math.floor((endMs - startMs) / 864e5);
  return { months, days, eligible: days >= SGP.minDays && months >= 0.5 };
}
export function fmtMonths(m){
  if (m == null) return '';
  return `${m} month${m === 1 ? '' : 's'}`;
}
export function certCode(id){ return 'SGP-' + String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase(); }
export function verifyUrl(id){ return SGP.publicBase + 'certificate.html?v=' + encodeURIComponent(id); }
export function certTitle(kind){ return kind === 'INTERN' ? 'Certificate of Internship' : 'Experience Certificate'; }

/* app = hiringApplications doc (+id), role = hiringRoles doc */
export function buildCert(app, role, now = Date.now()){
  const o = app.offer || {}, ov = app.certOverride || {};
  const empType = o.jobType || (role && role.employmentType) || 'FULL_TIME';
  const intern = empType === 'INTERN';
  const plannedMonths = Number(o.durationMonths) || 6;
  const start = toMs(app.offerAcceptedAt);
  const base = {
    id: app.id, uid: app.uid, name: app.name || '', empType,
    roleTitle: ov.roleTitle || o.roles || (role && role.title) || 'Team Member',
    department: (role && role.department) || '',
    kind: ov.kind || (intern ? 'INTERN' : 'JOB'),
    startMs: start, plannedMonths: intern ? plannedMonths : null, note: ov.note || '',
  };
  if (app.hiredEndType) return { ...base, state: 'revoked', eligible: false };
  if (!start) return { ...base, state: 'none', eligible: false };

  // Admin force-issue — bypasses the 15-day rule entirely
  if (ov.forceIssue) {
    const forceEnd = ov.issueDate ? toMs(ov.issueDate) : now;
    const forceMonths = ov.months != null ? Number(ov.months) : null;
    const forceDurLabel = ov.durationLabel || (forceMonths != null ? fmtMonths(forceMonths) : 'As specified');
    const forceDays = Math.max(0, Math.floor((forceEnd - start) / 864e5));
    return { ...base, state: 'completed', endMs: forceEnd, plannedEndMs: null,
             days: forceDays, months: forceMonths, durationLabel: forceDurLabel,
             eligible: true, issuedMs: forceEnd, forceIssued: true };
  }

  const plannedEnd = intern ? addM(start, plannedMonths) : null;
  let end, state;
  if (app.offerStatus === 'left') { end = toMs(app.offerLeftAt) || now; state = 'left'; }
  else if (plannedEnd && now >= plannedEnd) { end = plannedEnd; state = 'completed'; }
  else { end = now; state = 'active'; }
  if (plannedEnd && end > plannedEnd) end = plannedEnd;

  const d = certDuration(start, end);
  const full = plannedEnd && end >= plannedEnd;
  let months = full ? plannedMonths : d.months;
  if (ov.months) months = Number(ov.months);
  const eligible = state !== 'active' && (full || d.eligible || !!ov.months);
  const issued = ov.issueDate ? toMs(ov.issueDate) : end;
  return { ...base, state: full && state === 'left' ? 'completed' : state, endMs: end, plannedEndMs: plannedEnd,
           days: d.days, months, durationLabel: fmtMonths(months), eligible, issuedMs: issued };
}

/* what gets mirrored to the public `certificates/{id}` doc (QR verification) */
export function publicDoc(c){
  return {
    uid: c.uid || '', name: c.name, roleTitle: c.roleTitle, department: c.department || '',
    kind: c.kind, empType: c.empType, startMs: c.startMs, endMs: c.endMs,
    months: c.months, durationLabel: c.durationLabel, issuedMs: c.issuedMs,
    note: c.note || '', status: 'valid', forceIssued: !!c.forceIssued,
  };
}
