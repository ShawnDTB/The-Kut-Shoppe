import { getCustomerSession, subscribeToCustomerSession } from './customer-api';
export type PlatformAccount = { id:string;name:string;email:string;role:string };
export const getPlatformSessionAccount=():PlatformAccount|null=>{const a=getCustomerSession();return a?{id:a.id,name:a.profile.name,email:a.email,role:a.role}:null;};
export const subscribeToPlatformAuth=subscribeToCustomerSession;
export const hasPlatformCapability=(account:PlatformAccount|null,capability:string)=>Boolean(account&&['owner','manager','developer'].includes(account.role)&&['manage-products','manage-orders'].includes(capability));
export const isValidEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const isValidPhone=(value:string)=>value.replace(/\D/g,'').length>=10;
export const getCustomerProfileV5=(account:PlatformAccount)=>{const session=getCustomerSession();return session?.id===account.id?session.profile:null;};
