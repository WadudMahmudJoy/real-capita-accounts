'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {collectOnboardingProof, onboardingCommand, onboardingStatus, type OnboardingStatus} from '@/lib/onboarding-api';
import {Button, Card, Field, LoadingPanel, Notice, Select, TextInput} from '../../_components/ui';
import {Permit} from '../../_components/permission-controls';

const verified = (value: boolean) => value ? 'Verified' : 'Pending verification';

export function OnboardingPanel() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''), [name, setName] = useState(''), [reason, setReason] = useState(''), [target, setTarget] = useState(''), [permission, setPermission] = useState('HR_ADMIN'), [expiry, setExpiry] = useState('');
  useEffect(() => {let live = true; void onboardingStatus().then(value => {if(live) setStatus(value);}).catch(() => {if(live) setError('Secure onboarding is unavailable. Deployment and private provider configuration must be verified before invitations or authority changes.');}); return () => {live = false;};}, []);
  const enabled = Boolean(status?.installed && status.configured && !busy);
  async function run(command: string, payload: Record<string, unknown>) {
    if (!enabled) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const proof = await collectOnboardingProof(command, payload);
      await onboardingCommand(command, payload, proof);
      setStatus(await onboardingStatus());
      setMessage('The protected operation completed. Review the resulting state and audit history.');
    } catch {
      setError('Operation unavailable, denied or expired. Complete independent verification through the configured private service, then refresh the current state before retrying. No authority is granted by a pending request.');
      try {setStatus(await onboardingStatus());} catch { /* Preserve unavailable state. */ }
    } finally {setBusy(false);}
  }
  return <Card className="min-w-0 space-y-4"><h2 className="font-semibold text-lg">Leadership onboarding</h2>
    <p className="text-sm">Account control, employment identity and business authority are verified separately. Pending requests grant no permissions.</p>
    {error && <div role="alert"><Notice tone="error">{error}</Notice></div>}
    {message && <div role="status"><Notice tone="success">{message}</Notice></div>}
    {!status && !error && <LoadingPanel message="Checking secure onboarding readiness…"/>}
    {status && <>
      <p>Schema: {status.installed ? 'Installed' : 'Not deployed'} · Private provider: {status.configured ? 'Configured' : 'Unavailable'}</p>
      {status.blockers.length > 0 && <Notice tone="info"><ul className="list-disc pl-5">{status.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul></Notice>}
      <div className="grid gap-4 md:grid-cols-2">
        <div><h3 className="font-semibold">Your verification state</h3><ul><li>Account: {status.own.state}</li><li>Email control: {verified(status.own.emailVerified)}</li><li>Individual identity: {verified(status.own.identityVerified)}</li><li>Global Employee binding: {verified(status.own.employeeBound)}</li><li>MD authority: {status.own.mdActivated ? 'Active' : 'Not active'}</li></ul></div>
        <div><h3 className="font-semibold">Initial MD onboarding checklist</h3><ol className="list-decimal pl-5"><li>Authenticate the independent authorizer and verify company appointment authority through the private evidence process.</li><li>Verify nominated MD account control and authoritative Employee Code/ID.</li><li>Collect an independent attestation bound to that identity, authority, nonce and expiry.</li><li>Consume once through the protected executor; retain immutable history.</li></ol><p className="mt-2 text-sm">The authorizer’s company authorization must exist independently of any later MD software delegation. Account claiming alone cannot activate MD authority.</p></div>
      </div>
      {(status.canManage || status.canReview || status.own.identityVerified && status.own.employeeBound && status.own.state !== 'SUSPENDED') && <>
        <h3 className="font-semibold">Pending invitations and identity verification</h3>
        <div className="grid gap-3 sm:grid-cols-2">{status.items.map(item => <article key={item.id} className="min-w-0 rounded border p-3 space-y-1"><h4 className="font-medium break-words">{item.fullName}</h4><p className="break-all">{item.email}</p><p>State: {item.state} · Revision {item.version}</p><p>Email: {verified(item.emailVerified)} · Identity: {verified(item.identityVerified)}</p><p>Employee binding: {item.employeeId ? 'Bound after verification' : 'Pending authoritative Employee verification'}</p>{status.canManage && <div className="flex flex-wrap gap-2"><Button className="h-auto min-h-10 max-w-full whitespace-normal break-all py-2" variant="secondary" disabled={!enabled || !item.invitationId} onClick={() => void run('CANCEL', {invitationId:item.invitationId})}>Cancel invitation for {item.fullName}</Button><Button className="h-auto min-h-10 max-w-full whitespace-normal break-all py-2" variant="secondary" disabled={!enabled || !reason.trim()} onClick={() => void run('SUSPEND', {targetUserId:item.userId,reason})}>Suspend {item.fullName}</Button></div>}</article>)}</div>
        {status.items.length === 0 && <p>No visible onboarding invitations.</p>}
        <Field label="Protected operation reason" htmlFor="onboarding-reason"><TextInput id="onboarding-reason" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></Field>
        {status.canManage && <div className="grid gap-4 sm:grid-cols-2"><Field label="Invitation full name" htmlFor="onboarding-name"><TextInput id="onboarding-name" maxLength={150} value={name} onChange={e => setName(e.target.value)}/></Field><Field label="Invitation email" htmlFor="onboarding-email"><TextInput id="onboarding-email" type="email" value={email} onChange={e => setEmail(e.target.value)}/></Field><div className="sm:col-span-2"><Button className="h-auto min-h-10 max-w-full whitespace-normal break-all py-2" disabled={!enabled || !name.trim() || !email.includes('@') || !reason.trim()} onClick={() => void run('INVITE', {email, name, reason})}>Request private invitation verification</Button></div>
          <Field label="Verified account for authorization" htmlFor="onboarding-target"><Select id="onboarding-target" value={target} onChange={e => setTarget(e.target.value)}><option value="">Select an account</option>{status.items.filter(item => item.identityVerified && item.emailVerified && item.employeeId).map(item => <option key={item.id} value={item.userId}>{item.fullName} — {item.email}</option>)}</Select></Field>
          <Field label="Specialized responsibility" htmlFor="onboarding-permission"><Select id="onboarding-permission" value={permission} onChange={e => setPermission(e.target.value)}><option value="SYSTEM_ADMIN">System Administrator</option><option value="ACCOUNTANT">Accountant</option><option value="HR_ADMIN">HR/Admin</option></Select></Field>
          <Field label="Authorization expires at" htmlFor="onboarding-expiry"><TextInput id="onboarding-expiry" type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)}/></Field>
          <div className="self-end"><Button className="h-auto min-h-10 max-w-full whitespace-normal break-all py-2" disabled={!enabled || !target || !reason.trim() || !expiry} onClick={() => {const item=status.items.find(row => row.userId === target); if(item && expiry) void run('REQUEST_SPECIALIZED',{targetUserId:target,permission,reason,expectedVersion:item.version,expiresAt:new Date(expiry).toISOString()});}}>Request MD authorization</Button></div>
        </div>}
        {!status.canManage && status.own.identityVerified && status.own.employeeBound && <div className="grid gap-4 sm:grid-cols-2">
          <h3 className="font-semibold sm:col-span-2">Request your specialized responsibility</h3>
          <p className="text-sm sm:col-span-2">This requests MD review for your own verified account. The request gives you no authority until an independent MD approves it.</p>
          <Field label="Specialized responsibility" htmlFor="onboarding-own-permission"><Select id="onboarding-own-permission" value={permission} onChange={e => setPermission(e.target.value)}><option value="SYSTEM_ADMIN">System Administrator</option><option value="ACCOUNTANT">Accountant</option><option value="HR_ADMIN">HR/Admin</option></Select></Field>
          <Field label="Authorization expires at" htmlFor="onboarding-own-expiry"><TextInput id="onboarding-own-expiry" type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)}/></Field>
          <div><Button className="h-auto min-h-10 max-w-full whitespace-normal break-all py-2" disabled={!enabled || !reason.trim() || !expiry || !status.own.userId || !status.own.version} onClick={() => {if(expiry) void run('REQUEST_SPECIALIZED',{targetUserId:status.own.userId,permission,reason,expectedVersion:status.own.version,expiresAt:new Date(expiry).toISOString()});}}>Request MD authorization for your account</Button></div>
        </div>}
        <h3 className="font-semibold">Specialized authority requests</h3><p className="text-sm">Only the live MD may approve specialized responsibilities. Generic custom roles cannot grant these responsibilities.</p>
        <ul className="space-y-3">{status.requests.map(request => <li key={request.id} className="rounded border p-3 break-words"><p>{request.permission} · {request.status}</p><p>{request.reason}</p>{status.canReview && <div className="mt-2 flex flex-wrap gap-2">{request.status === 'PENDING' && ['APPROVE','REJECT'].map(decision => <Button className="h-auto min-h-10 max-w-full whitespace-normal break-all py-2" key={decision} disabled={!enabled || !reason.trim()} onClick={() => void run('DECIDE_SPECIALIZED',{requestId:request.id,decision,reason})}>{decision === 'APPROVE' ? 'Approve' : 'Reject'} {request.permission} request {request.id}</Button>)}{request.status === 'APPROVED' && <Button className="h-auto min-h-10 max-w-full whitespace-normal break-all py-2" disabled={!enabled || !reason.trim()} onClick={() => void run('REVOKE_SPECIALIZED',{requestId:request.id,reason})}>Revoke {request.permission} request {request.id}</Button>}</div>}</li>)}</ul>
        <h3 className="font-semibold">Delegation, recovery and revocation</h3><p>MD delegation establishes a bounded permission ceiling. Role creation and assignment remain subject to that ceiling and independent MD approval where required.</p><Permit code="roles.view"><Link className="underline" href="/app/roles">Review permission-controlled Role Management</Link></Permit>
        <p className="text-sm">Employee bindings, initial attestations, MD activation and privileged account replacement require the private authenticated evidence process. Supply authoritative Employee Code/ID there. Recovery cannot reuse revoked authority or bypass independent authorization.</p>
        <h3 className="font-semibold">Onboarding audit history</h3><ul>{status.history.map(event => <li key={event.id} className="break-words">{event.action} · {event.createdAt}</li>)}</ul>{status.history.length === 0 && <p>No visible onboarding events.</p>}
      </>}
    </>}
    <p className="text-sm">Private identity evidence, passwords and invitation capabilities are never displayed here. Missing provider configuration keeps protected operations unavailable.</p>
  </Card>;
}
