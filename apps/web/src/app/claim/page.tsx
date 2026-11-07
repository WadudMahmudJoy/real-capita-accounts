'use client';

import Link from 'next/link';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {claimAccount} from '@/lib/onboarding-api';
import {Button, Card, Field, Notice, TextInput} from '../app/_components/ui';

export default function ClaimPage() {
  const capability = useRef('');
  const [ready, setReady] = useState(false), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [done, setDone] = useState(false);
  useEffect(() => {
    // Capabilities never enter query strings, storage, rendered output or logs.
    const readFragment = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1)).get('capability');
      if (fragment) capability.current = fragment;
      window.history.replaceState(null, '', window.location.pathname);
      setReady(capability.current.length > 0);
    };
    readFragment();
    window.addEventListener('hashchange', readFragment);
    return () => window.removeEventListener('hashchange', readFragment);
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy || password.length < 14 || new TextEncoder().encode(password).length > 72) return;
    setBusy(true); setMessage('');
    try {
      await claimAccount(capability.current, password);
      setDone(true); setMessage('Account control verified. Identity verification and business authorization remain separate. Sign in using your individual account when enabled.');
    } catch {
      // Provider errors must never echo a capability or credential.
      setMessage('Claim unavailable or no longer valid. Request a new invitation through your company’s private onboarding process.');
    } finally {
      capability.current = ''; setPassword(''); setReady(false); setBusy(false);
    }
  }
  return <main className="mx-auto w-full max-w-xl space-y-4 p-4 sm:p-8"><Card>
    <h1 className="text-xl font-semibold">Claim your individual account</h1>
    <p className="my-4 text-sm">Use the invitation delivered by the configured identity provider. Claiming verifies account control; it grants no business permissions.</p>
    {!ready && !message && <Notice tone="info">No active claim capability is present. Request an invitation through the company’s private onboarding process.</Notice>}
    {message && <div role="status"><Notice tone={done ? 'success' : 'error'}>{message}</Notice></div>}
    <form onSubmit={submit} className="mt-4 space-y-4">
      <Field htmlFor="claim-password" label="New individual password" hint="At least 14 characters and at most 72 UTF-8 bytes."><TextInput id="claim-password" type="password" autoComplete="new-password" minLength={14} maxLength={72} required disabled={!ready || busy} value={password} onChange={e => setPassword(e.target.value)}/></Field>
      <Button disabled={!ready || busy || password.length < 14 || new TextEncoder().encode(password).length > 72} type="submit">{busy ? 'Verifying claim…' : 'Verify account control'}</Button>
    </form>
    <Link className="mt-4 inline-block underline" href="/login">Return to sign in</Link>
  </Card></main>;
}
