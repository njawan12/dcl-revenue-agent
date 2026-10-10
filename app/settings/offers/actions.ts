'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireActiveWorkspace } from '../../../lib/workspaces/session';

function lines(formData:FormData,name:string){return String(formData.get(name)||'').split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);}
function number(formData:FormData,name:string,fallback:number){const n=Number(formData.get(name));return Number.isFinite(n)?n:fallback;}
function slugify(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||`offer-${Date.now()}`;}

export async function saveOfferProfile(formData:FormData){
  const workspace=await requireActiveWorkspace();
  if(!['owner','admin'].includes(workspace.role)) redirect('/settings/offers?error=Owner%20or%20admin%20required');
  const supabase=await createClient();
  const id=String(formData.get('id')||'').trim();
  const name=String(formData.get('name')||'').trim().slice(0,120);
  if(!name) redirect('/settings/offers?error=Profile%20name%20is%20required');
  const profileKey=String(formData.get('profileKey')||'').trim()||slugify(name);
  const jobsPerRun=Math.min(25,Math.max(1,number(formData,'jobsPerRun',25)));
  const contactsPerRun=Math.min(25,Math.max(1,number(formData,'contactsPerRun',25)));
  const policyBasisStatus=formData.get('policyBasisVerified')==='on'?'verified':'pending_review';
  const row={
    workspace_id:workspace.id,
    profile_key:profileKey,
    name,
    active:formData.get('active')==='on',
    priority:Math.max(0,number(formData,'priority',100)),
    lookback_days:Math.max(1,Math.min(90,number(formData,'lookbackDays',14))),
    target_job_titles:lines(formData,'targetJobTitles'),
    target_countries:lines(formData,'targetCountries'),
    employee_min:Math.max(1,number(formData,'employeeMin',20)),
    employee_max:Math.max(1,number(formData,'employeeMax',5000)),
    excluded_industries:lines(formData,'excludedIndustries'),
    buyer_roles:lines(formData,'buyerRoles'),
    offer:{
      name:String(formData.get('offerName')||name).trim(),
      summary:String(formData.get('offerSummary')||'').trim(),
      positioning:String(formData.get('positioning')||'').trim(),
      cta:String(formData.get('cta')||'').trim(),
    },
    email_config:{
      tone:String(formData.get('tone')||'human, concise, specific, commercially credible, no hype').trim(),
      maxWords:Math.max(60,Math.min(220,number(formData,'maxWords',130))),
      subjectStyle:String(formData.get('subjectStyle')||'plain and relevant; no clickbait').trim(),
      template:String(formData.get('template')||'').trim(),
      policyBasisStatus,
    },
    caps:{
      jobsPerRun,contactsPerRun,
      leadsPerDay:Math.max(1,number(formData,'leadsPerDay',25)),
      leadsPerWeek:Math.max(1,number(formData,'leadsPerWeek',100)),
      creditsPerRun:Math.max(1,number(formData,'creditsPerRun',60)),
      creditsPerDay:Math.max(1,number(formData,'creditsPerDay',60)),
      creditsPerWeek:Math.max(1,number(formData,'creditsPerWeek',250)),
    },
    scoring_config:{requireHiringTrigger:true,maxJobAgeDays:Math.max(1,Math.min(90,number(formData,'lookbackDays',14))),hiringPrimary:true,storefrontSecondary:true},
    updated_at:new Date().toISOString(),
  };
  let error;
  if(id){({error}=await supabase.from('offer_profiles').update(row).eq('workspace_id',workspace.id).eq('id',id));}
  else{({error}=await supabase.from('offer_profiles').insert(row));}
  if(error) redirect(`/settings/offers?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/settings/offers'); revalidatePath('/'); revalidatePath('/discover');
  redirect('/settings/offers?notice=Offer%20profile%20saved');
}
