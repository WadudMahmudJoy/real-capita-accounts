import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hrTables} from './hr-runtime-privileges';
export async function verifyHrDeploymentCatalog(db:any,sqlFiles:string[],owner:string){
 const sql=sqlFiles.map(p=>readFileSync(p,'utf8')).join('\n');
 const fns=new Map<string,string>();for(const m of sql.matchAll(/CREATE(?: OR REPLACE)? FUNCTION (\w+)\(\) RETURNS trigger LANGUAGE plpgsql AS \$\$([\s\S]*?)\$\$;/g))fns.set(m[1],m[2]);
 assert.equal(fns.size,10);
 for(const [name,body]of fns){const actual=(await db.query("SELECT prosrc,prosecdef,pg_get_userbyid(proowner) AS owner FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=$1",[name])).rows;assert.equal(actual.length,1);assert.equal(actual[0].prosrc.trim(),body.trim(),`Function body drift ${name}`);assert.equal(actual[0].owner,owner);assert.equal(actual[0].prosecdef,false);}
 const triggers=[...sql.matchAll(/CREATE (?:CONSTRAINT )?TRIGGER (\w+) ([^;]+?)EXECUTE FUNCTION (\w+)\(\)/g)];
 const actualTriggers=(await db.query("SELECT t.tgname,p.proname,t.tgenabled,t.tgdeferrable,t.tginitdeferred FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal AND t.tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[]))",[[...hrTables,'users','user_roles']])).rows;
 for(const [,name,definition,fn]of triggers){const t=actualTriggers.find((t:any)=>t.tgname===name);assert(t&&t.proname===fn&&t.tgenabled==='O',`Trigger drift ${name}`);if(definition.includes('DEFERRABLE INITIALLY DEFERRED'))assert(t.tgdeferrable&&t.tginitdeferred);}
 const indexNames=[...sql.matchAll(/CREATE (?:UNIQUE )?INDEX "?(\w+)"? ON /g)].map(m=>m[1]);const indexes=(await db.query("SELECT c.relname,i.indisvalid,i.indisunique,pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace")).rows;
 for(const name of indexNames)assert(indexes.some((i:any)=>i.relname===name&&i.indisvalid),`Missing index ${name}`);
 for(const name of ['employee_binding_active_user_unique','employee_binding_active_employee_unique','user_permission_unreleased_unique']){const i=indexes.find((i:any)=>i.relname===name);assert(i.indisunique&&i.definition.includes('WHERE'));}
 const constraints=(await db.query("SELECT conname,contype,convalidated,confdeltype,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[]))",[hrTables])).rows;
 assert.equal(constraints.filter((c:any)=>c.contype==='f'&&c.confdeltype==='r').length,17);assert(constraints.every((c:any)=>c.convalidated));
 for(const name of ['leave_dates_valid','leave_state_valid','leave_employee_range_no_overlap','user_permission_lifecycle','employee_binding_lifecycle','leave_category_valid'])assert(constraints.some((c:any)=>c.conname===name));
 assert(constraints.find((c:any)=>c.conname==='leave_employee_range_no_overlap').definition.includes('daterange'));
 const enums=(await db.query("SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace AND t.typname IN ('LeaveRequestStatus','HrPermission') ORDER BY t.typname,e.enumsortorder")).rows;assert.equal(enums.length,6);
 return {tables:6,functions:fns.size,triggers:triggers.length,indexes:indexNames.length,restrictiveForeignKeys:17,allValidated:true};
}
