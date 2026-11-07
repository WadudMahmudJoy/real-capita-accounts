"use client";
import {createContext,useContext,type ReactNode,type ComponentProps} from 'react';
import {Button} from './ui';
export const WorkspacePermissions=createContext<string[]|null>(null);
export function usePermission(code:string){const allowed=useContext(WorkspacePermissions);return allowed===null||allowed.includes(code);}
export function Permit({code,children}:{code:string;children:ReactNode}){const allowed=useContext(WorkspacePermissions);return allowed===null||allowed.includes(code)?children:null;}
export function PermissionButton({permission,...props}:ComponentProps<typeof Button>&{permission?:string}){const allowed=useContext(WorkspacePermissions);return permission&&allowed!==null&&!allowed.includes(permission)?null:<Button {...props}/>;}
