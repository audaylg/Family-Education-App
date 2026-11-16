// End-to-end test against a RUNNING app (npm start / npm run dev) and the real Supabase project.
// Usage:  node scripts/e2e-test.mjs   (optional: BASE_URL=http://localhost:3000)
// Writes logs/test-report.md. Never prints secrets. Cleans up all test users/families it creates.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).split(/\s+#/)[0].trim()] }))
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const rows = []; const check = (n, ok, extra = '') => { rows.push(`| ${ok ? 'PASS' : 'FAIL'} | ${n} | ${extra} |`); console.log(ok ? 'PASS' : 'FAIL', n) }
const need = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
for (const k of need) check(`env ${k} is set`, !!env[k])
const save = () => { fs.mkdirSync(path.join(root, 'logs'), { recursive: true })
  fs.writeFileSync(path.join(root, 'logs', 'test-report.md'), `# E2E test report (${new Date().toISOString()})\nBase: ${BASE}\n\n| Result | Test | Note |\n|---|---|---|\n${rows.join('\n')}\n`) }
if (need.some(k => !env[k])) { save(); process.exit(1) }
const mk = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ts = Date.now(), pw = 'Test-' + ts + '-Aa1!'
const email = n => `e2e.${n}.${ts}@example.com`
const reg = async body => { const r = await fetch(BASE + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { ok: r.ok, status: r.status } }
const users = [], fams = []
try {
  // 1. parent registration (two families)
  const p1 = await reg({ role: 'parent', fullName: 'ولي أمر 1', email: email('p1'), password: pw, familyName: 'عائلة 1' })
  check('parent 1 registration via /api/register', p1.ok, 'HTTP ' + p1.status)
  const p2 = await reg({ role: 'parent', fullName: 'ولي أمر 2', email: email('p2'), password: pw, familyName: 'عائلة 2' })
  check('parent 2 registration', p2.ok)
  const bad = await reg({ role: 'parent', fullName: 'x', email: 'bad', password: '1', familyName: '' })
  check('invalid registration rejected', bad.status === 400, 'HTTP ' + bad.status)
  const P1 = mk(), P2 = mk()
  const s1 = await P1.auth.signInWithPassword({ email: email('p1'), password: pw })
  const s2 = await P2.auth.signInWithPassword({ email: email('p2'), password: pw })
  check('parents can sign in', !s1.error && !s2.error)
  users.push(s1.data.user?.id, s2.data.user?.id)
  const fam1 = (await P1.from('profiles').select('family_id').eq('id', s1.data.user.id).single()).data.family_id
  const fam2 = (await P2.from('profiles').select('family_id').eq('id', s2.data.user.id).single()).data.family_id
  // 2. student creation + invitation code
  fams.push(fam1, fam2)
  const c1 = await P1.from('students').insert({ family_id: fam1, name: 'ابن 1' }).select('id,invite_code').single()
  const c2 = await P2.from('students').insert({ family_id: fam2, name: 'ابن 2' }).select('id,invite_code').single()
  check('parent creates child and gets invite code', !c1.error && !!c1.data?.invite_code)
  const evil = await P1.from('students').insert({ family_id: fam2, name: 'اختراق' })
  check('parent cannot create child in another family', !!evil.error)
  // 3. student registration with invite code
  const st = await reg({ role: 'student', fullName: 'طالب 1', email: email('s1'), password: pw, inviteCode: c1.data.invite_code })
  check('student registration with invite code', st.ok, 'HTTP ' + st.status)
  const reuse = await reg({ role: 'student', fullName: 'طالب مكرر', email: email('s1b'), password: pw, inviteCode: c1.data.invite_code })
  check('invite code cannot be reused', !reuse.ok, 'HTTP ' + reuse.status)
  const wrong = await reg({ role: 'student', fullName: 'طالب', email: email('s1c'), password: pw, inviteCode: 'ffffffffff' })
  check('wrong invite code rejected', !wrong.ok, 'HTTP ' + wrong.status)
  const S = mk(); const ss = await S.auth.signInWithPassword({ email: email('s1'), password: pw })
  check('student can sign in', !ss.error); users.push(ss.data.user?.id)
  // 4. permissions
  await P1.from('homework').insert({ family_id: fam1, student_id: c1.data.id, title: 'واجب', due_date: new Date().toISOString().slice(0, 10) })
  await P2.from('homework').insert({ family_id: fam2, student_id: c2.data.id, title: 'واجب آخر', due_date: new Date().toISOString().slice(0, 10) })
  const hw = await S.from('homework').select('id,title'); check('student sees only own homework', hw.data?.length === 1)
  const sk = await S.from('students').select('id'); check('student sees only own student row', sk.data?.length === 1)
  const upd = await S.from('homework').update({ status: 'done' }).eq('id', hw.data[0].id).select(); check('student can mark own homework done', upd.data?.length === 1)
  const led = await S.from('points_ledger').insert({ family_id: fam1, student_id: c1.data.id, delta: 999, reason: 'cheat' }); check('student cannot add points', !!led.error)
  const pts = await S.from('students').update({ points_balance: 999 }).eq('id', c1.data.id).select(); check('student cannot edit own points', !pts.data?.length)
  const del = await S.from('students').delete().eq('id', c1.data.id).select(); check('student cannot delete own record', !del.data?.length)
  const keys = await S.from('quiz_answer_keys').select('*'); check('student cannot read answer keys', !keys.data?.length)
  const cross = await P2.from('homework').select('id').eq('student_id', c1.data.id); check('other family cannot see this family data', !cross.data?.length)
  const add = await P1.from('points_ledger').insert({ family_id: fam1, student_id: c1.data.id, delta: 50, reason: 'اختبار' })
  const bal = await P1.from('students').select('points_balance').eq('id', c1.data.id).single()
  check('parent adds points and balance updates (trigger)', !add.error && bal.data?.points_balance === 50, 'balance=' + bal.data?.points_balance)
  const anon = await mk().from('students').select('id'); check('anonymous user cannot read students', !anon.data?.length)
  // 5. parent deletion of student account (what /api/children DELETE does)
  await admin.auth.admin.deleteUser(ss.data.user.id); const gone = await admin.from('students').delete().eq('id', c1.data.id)
  check('parent-side deletion of student + account (service role)', !gone.error)
} catch (e) { check('test run completed without exception', false, String(e.message || e).slice(0, 120)) }
finally {
  for (const id of users.filter(Boolean)) await admin.auth.admin.deleteUser(id).catch(() => {})
  if (fams.length) await admin.from('families').delete().in('id', fams)
  save(); console.log('report: logs/test-report.md')
}
