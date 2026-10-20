"use client";
import {PermissionButton} from "../../_components/permission-controls";
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {getCompanies,toErrorMessage} from '@/lib/api';
import {previewPayroll,createPayrollDraft,deductionCategories,deductionLabels,type PayrollInput,type PayrollPreview} from '@/lib/payroll-workflow-api';
import {Card,Field,Notice,PageIntro,Select,TextInput} from '../../_components/ui';
import {formatPayrollMoney} from '../_components/payroll-document-view';
type Form = {amounts:string[];confirmed:boolean[];otherDescription:string};
const blank=():Form=>({amounts:['','','','',''],confirmed:[false,false,false,false,false],otherDescription:''});
export default function NewPayrollPage(){
 const router=useRouter(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 const [year,setYear]=useState(today.find(p=>p.type==='year')!.value),[month,setMonth]=useState(today.find(p=>p.type==='month')!.value);
 const [roster,setRoster]=useState<PayrollPreview["employees"]>([]),[currency,setCurrency]=useState("");
 const [preview,setPreview]=useState<PayrollPreview|null>(null),[forms,setForms]=useState<Record<string,Form>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[parent,setParent]=useState('');
 function invalidate(){setPreview(null);setError('');}
 function input():PayrollInput {
   if(!/^\d{1,4}$/.test(year)||Number(year)<1||Number(month)<1||Number(month)>12)throw Error('Select a valid payroll calendar year and month.');
   return {year:Number(year),month:Number(month),deductions:Object.entries(forms).map(([employeeId,f])=>{
     if(f.amounts.some(a=>!/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/.test(a)))throw Error('Enter every deduction amount explicitly, including zeros.');
     const otherZero=/^0(\.0{1,2})?$/.test(f.amounts[4]);
     if(!otherZero&&!f.otherDescription.trim())throw Error('Describe the other deduction. Positive deductions require verified authority and remain blocking.');
     return {employeeId,year:Number(year),month:Number(month),...Object.fromEntries(deductionCategories.map((key,i)=>[key,{amount:f.amounts[i],zeroConfirmed:f.confirmed[i]}])) as Record<typeof deductionCategories[number],{amount:string;zeroConfirmed:boolean}>,
       otherApprovedDeductions:otherZero?[]:[{amount:f.amounts[4],zeroConfirmed:false,description:f.otherDescription.trim()}],otherDeductionsZeroConfirmed:f.confirmed[4]};
   })};
 }
 async function assess(){setBusy(true);setError('');try{
   const result=await previewPayroll(input());setPreview(result);setRoster(result.employees);
   const companies=await getCompanies(),owner=companies.companies.find(c=>c.id===result.parent?.id&&c.singletonKey==='PRIMARY'&&c.isActive);setParent(owner?.name??'Active PRIMARY unavailable');setCurrency(owner?.currency??'');
   setForms(current=>Object.fromEntries(result.employees.map(e=>[e.employeeId,current[e.employeeId]??blank()])));
 }catch(e){setPreview(null);setError(toErrorMessage(e));}finally{setBusy(false);}}
 function confirmZeros(){setForms(current=>Object.fromEntries(Object.entries(current).map(([id,f])=>[id,{...f,amounts:f.amounts.map(a=>a||'0.00'),confirmed:f.amounts.map(a=>!a||/^0(\.0{1,2})?$/.test(a))}])));setPreview(null);}
 async function create(){setBusy(true);setError('');try{const run=await createPayrollDraft(input());router.push(`/app/payroll-runs/${run.id}`);}catch(e){setError(toErrorMessage(e));}finally{setBusy(false);}}
 return <div className="space-y-6"><PageIntro title="New monthly payroll" description="Real Capita Group · One monthly payroll across offices · Asia/Dhaka calendar month"/>
 <Link href="/app/payroll-runs" className="text-primary underline">Payroll history</Link>
 <Notice tone="info">Approval is not payment. Full-month approved salary and finalized attendance are required. Positive deductions remain blocked until independent approval evidence can be verified.</Notice>
 {error&&<Notice tone="error">{error}</Notice>}
 <Card><fieldset disabled={busy} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
 <Field htmlFor="payroll-year" label="Payroll year"><TextInput id="payroll-year" inputMode="numeric" value={year} onChange={e=>{setYear(e.target.value);setForms({});setRoster([]);setParent('');invalidate();}}/></Field>
 <Field htmlFor="payroll-month" label="Payroll month"><Select id="payroll-month" value={month} onChange={e=>{setMonth(e.target.value);setForms({});setRoster([]);setParent('');invalidate();}}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1).padStart(2,'0')}>{String(i+1).padStart(2,'0')}</option>)}</Select></Field></div>
 <PermissionButton permission="payroll.preview" onClick={()=>void assess()}>{busy?'Checking...':'Preview payroll'}</PermissionButton>
 {parent&&<p>Payroll authority: {parent} (PRIMARY)</p>}
 {Object.keys(forms).length>0&&<PermissionButton variant="secondary" onClick={confirmZeros}>Explicitly confirm zero deductions for this roster</PermissionButton>}
 {Object.entries(forms).map(([id,f])=><section key={id} className="rounded-lg border border-border p-4"><h2 className="font-semibold">{roster.find(e=>e.employeeId===id)?.fullName??'Employee'}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...deductionLabels,'Other deductions'].map((label,i)=><div key={label}><Field htmlFor={`${id}-deduction-${i}`} label={label}><TextInput id={`${id}-deduction-${i}`} inputMode="decimal" value={f.amounts[i]} onChange={e=>{setForms(current=>({...current,[id]:{...f,amounts:f.amounts.map((a,n)=>n===i?e.target.value:a),confirmed:f.confirmed.map((c,n)=>n===i?false:c)}}));setPreview(null);}}/></Field><label className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={f.confirmed[i]} onChange={e=>{setForms(current=>({...current,[id]:{...f,confirmed:f.confirmed.map((c,n)=>n===i?e.target.checked:c)}}));setPreview(null);}}/>Confirmed zero: {label}</label></div>)}<Field htmlFor={`${id}-other-description`} label="Other deduction description"><TextInput id={`${id}-other-description`} value={f.otherDescription} onChange={e=>{setForms(current=>({...current,[id]:{...f,otherDescription:e.target.value}}));setPreview(null);}}/></Field></div></section>)}
 </fieldset></Card>
 {preview&&<Card><h2 className="text-lg font-semibold">Readiness: {preview.status}</h2><p>Calendar: {preview.period.timeZone}. Preview creates no payroll record.</p>
 <ul className="my-4 space-y-2">{preview.exceptions.map((e,i)=><li key={i} className="text-sm text-destructive">{preview.employees.find(p=>p.employeeId===e.employeeId)?.fullName??'Payroll'}: {e.message} <span className="font-mono">({e.code}{e.category?`, ${e.category}`:''})</span></li>)}</ul>
 {preview.employees.length===0&&<p>No candidate employees are available for this assessment.</p>}
 <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Employee / department','Earnings components','Gross','Deductions','Net','Planned BANK','Planned CASH','Attendance'].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{preview.employees.map(e=><tr key={e.employeeId}><td className="p-2">{e.employeeCode} · {e.fullName}<p>{e.departmentName??'Department unavailable'} · {e.designation??''}</p></td><td className="p-2">{e.earnings.map(c=><p key={c.code}>{c.name} ({c.percentage}%): {formatPayrollMoney(c.amount)}</p>)}</td>{['grossSalary','totalDeductions','netPay','bankPay','cashPay'].map(k=><td className="p-2" key={k}>{e.financial.amounts?formatPayrollMoney(e.financial.amounts[k as keyof typeof e.financial.amounts]):'Unavailable'}</td>)}<td className="p-2">{e.attendance.coverage}</td></tr>)}</tbody></table></div>
 {preview.financialTotals.amounts&&<p className="mt-4 font-semibold">Total net salary: {formatPayrollMoney(preview.financialTotals.amounts.netPay)} {currency}</p>}
 <PermissionButton permission="payroll.create" className="mt-4" disabled={busy||!preview.readyForDraft} onClick={()=>void create()}>Create DRAFT payroll</PermissionButton><p className="mt-2 text-sm">Creation revalidates all sources inside its transaction. Unresolved employees are never omitted.</p></Card>}
 </div>;
}
