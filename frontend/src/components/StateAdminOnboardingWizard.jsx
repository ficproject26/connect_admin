import React, { useState, useCallback, useRef } from 'react';
import {
  X, ChevronRight, ChevronLeft, User, Phone, Globe,
  Shield, FileText, Eye, EyeOff, CheckCircle, AlertCircle, Upload,
  Trash2, CreditCard, Home, Lock, Check, Loader2, MapPin
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Puducherry'
];
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GENDERS = ['Male','Female','Other','Prefer not to say'];
const ADDRESS_PROOF_TYPES = [
  'Aadhaar Card','Passport','Voter ID','Driving Licence',
  'Utility Bill','Bank Statement','Rent Agreement','Other'
];
const STEPS = [
  { id:1, label:'Personal', icon:User },
  { id:2, label:'Contact',  icon:Phone },
  { id:3, label:'Territory',icon:Globe },
  { id:4, label:'KYC Docs', icon:FileText },
  { id:5, label:'Account',  icon:Lock },
  { id:6, label:'Review',   icon:CheckCircle },
];

// ── Helpers ──────────────────────────────────────────────────────────
const validateEmail   = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const validatePhone   = v => /^\d{10}$/.test(v.replace(/\D/g,''));
const validatePAN     = v => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v.trim().toUpperCase());
const validateAadhaar = v => /^\d{12}$/.test(v.replace(/\s/g,''));
const maskAadhaar     = v => { const d=v.replace(/\s/g,''); return d.length<4?d:'XXXX XXXX '+d.slice(-4); };
const pwScore = pw => {
  let s=0;
  if(pw.length>=8) s++;
  if(/[A-Z]/.test(pw)) s++;
  if(/[a-z]/.test(pw)) s++;
  if(/\d/.test(pw)) s++;
  if(/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};
const strengthLabel = s => ['','Very Weak','Weak','Fair','Strong','Very Strong'][s]||'';
const strengthColor = s => s<=1?'bg-red-500':s===2?'bg-orange-500':s===3?'bg-amber-500':'bg-emerald-500';
const fileToBase64  = f => new Promise((res,rej)=>{
  const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f);
});

// ── Primitive form components ────────────────────────────────────────
const Lbl = ({children, req}) => (
  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
    {children}{req && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

const Inp = ({err, cls='', ...p}) => (
  <input {...p} className={`w-full bg-slate-50 dark:bg-slate-950 border ${err?'border-red-400 dark:border-red-600':'border-slate-200 dark:border-slate-800'} rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${cls}`}/>
);

const Sel = ({err, children, ...p}) => (
  <select {...p} className={`w-full bg-slate-50 dark:bg-slate-950 border ${err?'border-red-400 dark:border-red-600':'border-slate-200 dark:border-slate-800'} rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer`}>
    {children}
  </select>
);

const ErrMsg = ({msg}) => msg ? (
  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
    <AlertCircle className="w-3 h-3 flex-shrink-0"/>{msg}
  </p>
) : null;

const FG = ({children}) => <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;

// ── Upload button ─────────────────────────────────────────────────────
const UploadBtn = ({label, value, onChange, accept='image/*,.pdf', optional}) => {
  const ref = useRef();
  return (
    <div>
      <Lbl req={!optional}>{label}</Lbl>
      {value ? (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0"/>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold truncate flex-1">{value.name||'File uploaded'}</span>
          <button type="button" onClick={()=>onChange(null)} className="text-slate-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      ) : (
        <button type="button" onClick={()=>ref.current?.click()}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-3 text-xs text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors cursor-pointer">
          <Upload className="w-4 h-4"/>{label}{optional&&<span className="text-slate-400">(Optional)</span>}
        </button>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e=>e.target.files?.[0]&&onChange(e.target.files[0])}/>
    </div>
  );
};

// ── Step bar ─────────────────────────────────────────────────────────
const StepBar = ({current}) => (
  <div className="flex items-center gap-0 mb-6">
    {STEPS.map((s,i) => {
      const done=current>s.id, active=current===s.id, Icon=s.icon;
      return (
        <React.Fragment key={s.id}>
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${done?'bg-emerald-500 border-emerald-500':active?'bg-primary-600 border-primary-600':'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
              {done?<Check className="w-4 h-4 text-white"/>:<Icon className={`w-3.5 h-3.5 ${active?'text-white':'text-slate-400'}`}/>}
            </div>
            <span className={`text-[9px] font-extrabold uppercase tracking-wide mt-1 ${active?'text-primary-600 dark:text-primary-400':done?'text-emerald-600 dark:text-emerald-400':'text-slate-400'}`}>{s.label}</span>
          </div>
          {i<STEPS.length-1&&<div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${done?'bg-emerald-400':'bg-slate-200 dark:bg-slate-700'}`}/>}
        </React.Fragment>
      );
    })}
  </div>
);

// ── Review row & section ──────────────────────────────────────────────
const RR = ({label, value, mono}) => (
  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <span className="text-[11px] text-slate-400 font-medium">{label}</span>
    <span className={`text-xs font-bold text-slate-700 dark:text-slate-200 text-right max-w-[55%] truncate ${mono?'font-mono':''}`}>
      {value||<span className="text-slate-300 dark:text-slate-600 font-normal italic">Not provided</span>}
    </span>
  </div>
);

const RS = ({title, icon:Icon, color, children}) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
      <div className={`p-1.5 rounded-lg ${color}`}><Icon className="w-3.5 h-3.5"/></div>
      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">{title}</span>
    </div>
    <div className="px-4 py-2">{children}</div>
  </div>
);

// ── Success screen ────────────────────────────────────────────────────
const SuccessScreen = ({result, onClose}) => (
  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mb-4">
      <CheckCircle className="w-8 h-8 text-emerald-500"/>
    </div>
    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">State Administrator Created!</h3>
    <p className="text-xs text-slate-400 mb-6">Onboarding complete. The account is now active.</p>
    <div className="w-full max-w-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-0.5 text-left mb-6">
      <RR label="Admin ID"       value={result?.registrationId||result?.admin?.registrationId} mono/>
      <RR label="Full Name"      value={result?.admin?.name}/>
      <RR label="Role"           value="STATE ADMINISTRATOR"/>
      <RR label="Assigned State" value={result?.admin?.assignedState}/>
      <RR label="Email"          value={result?.admin?.email}/>
      <RR label="Mobile"         value={result?.admin?.phone} mono/>
      <RR label="Status"         value={result?.admin?.status==='approved'?'Active':result?.admin?.status}/>
    </div>
    <button onClick={onClose} className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors cursor-pointer">
      Close &amp; View Administrators
    </button>
  </div>
);

// ── Section header ────────────────────────────────────────────────────
const SH = ({icon:Icon, color, title, sub}) => (
  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
    <div className={`p-1.5 rounded-lg ${color}`}><Icon className="w-4 h-4"/></div>
    <div>
      <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="text-[10px] text-slate-400">{sub}</p>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════
// MAIN WIZARD COMPONENT
// ════════════════════════════════════════════════════════════════════
const StateAdminOnboardingWizard = ({token, API_BASE, prefilledState='', onClose, onSuccess, onToast}) => {
  const [step,   setStep]   = useState(1);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  const notify = useCallback((msg, type='info') => {
    if (typeof onToast === 'function') onToast(msg, type);
  }, [onToast]);

  // ── Form state ─────────────────────────────────────────────────────
  const [pers, setPers] = useState({
    fullName:'', dateOfBirth:'', gender:'', fatherName:'',
    bloodGroup:'', nationality:'Indian', profilePhoto:null
  });
  const [cont, setCont] = useState({
    primaryMobile:'', alternateMobile:'', email:'',
    addressLine1:'', addressLine2:'', locality:'', city:'',
    taluk:'', residentialDistrict:'', residentialState:'',
    residentialPincode:'', postOffice:''
  });
  const [terr, setTerr] = useState({ assignedState: prefilledState });
  const [kyc,  setKyc]  = useState({
    aadhaarNumber:'', aadhaarFront:null, aadhaarBack:null,
    panNumber:'', panDoc:null, useAadhaarAsAddressProof:false,
    addressProofType:'', addressProofNumber:'', addressProofDoc:null
  });
  const [acc,  setAcc]  = useState({
    password:'', confirmPassword:'', showPw:false, showCf:false, status:'Active'
  });
  const [decl, setDecl] = useState(false);

  const upP = (k,v) => setPers(p=>({...p,[k]:v}));
  const upC = (k,v) => setCont(p=>({...p,[k]:v}));
  const upK = (k,v) => setKyc(p=>({...p,[k]:v}));
  const upA = (k,v) => setAcc(p=>({...p,[k]:v}));
  const clrErr = (...keys) => setErrors(e=>{ const n={...e}; keys.forEach(k=>delete n[k]); return n; });

  // ── Validation ─────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step===1) {
      if (!pers.fullName.trim()) e.fullName='Full name is required';
      else if (!/^[a-zA-Z\s.'-]{2,80}$/.test(pers.fullName.trim())) e.fullName='2-80 chars, letters only';
      if (!pers.dateOfBirth) e.dateOfBirth='Date of birth is required';
      else if (new Date(pers.dateOfBirth)>=new Date()) e.dateOfBirth='Cannot be a future date';
      if (!pers.gender) e.gender='Gender is required';
    }
    if (step===2) {
      if (!cont.primaryMobile) e.primaryMobile='Primary mobile is required';
      else if (!validatePhone(cont.primaryMobile)) e.primaryMobile='Enter a valid 10-digit mobile';
      if (cont.alternateMobile && !validatePhone(cont.alternateMobile)) e.alternateMobile='Enter valid 10-digit mobile';
      if (!cont.email) e.email='Email is required';
      else if (!validateEmail(cont.email)) e.email='Enter a valid email address';
      if (!cont.addressLine1.trim()) e.addressLine1='Address Line 1 is required';
      if (!cont.city.trim()) e.city='City / Village is required';
      if (!cont.residentialState) e.residentialState='State is required';
      if (!cont.residentialPincode) e.residentialPincode='Pincode is required';
      else if (!/^\d{6}$/.test(cont.residentialPincode)) e.residentialPincode='Must be exactly 6 digits';
    }
    if (step===3) {
      if (!terr.assignedState) e.assignedState='Please select the assigned state';
    }
    if (step===4) {
      if (!kyc.aadhaarNumber) e.aadhaarNumber='Aadhaar number is required';
      else if (!validateAadhaar(kyc.aadhaarNumber)) e.aadhaarNumber='Must be exactly 12 digits';
      if (!kyc.panNumber) e.panNumber='PAN number is required';
      else if (!validatePAN(kyc.panNumber)) e.panNumber='Invalid format (e.g. ABCDE1234F)';
      if (!kyc.useAadhaarAsAddressProof && !kyc.addressProofType) e.addressProofType='Select an address proof type';
    }
    if (step===5) {
      const pw = acc.password;
      if (!pw) e.password='Password is required';
      else if (pw.length<8) e.password='Minimum 8 characters required';
      else if (pwScore(pw)<3) e.password='Too weak — add uppercase, numbers and symbols';
      if (!acc.confirmPassword) e.confirmPassword='Please confirm your password';
      else if (pw!==acc.confirmPassword) e.confirmPassword='Passwords do not match';
    }
    if (step===6) {
      if (!decl) e.declaration='You must confirm the declaration before submitting';
    }
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const next = () => { if (validate()) setStep(s=>Math.min(s+1,6)); };
  const prev = () => setStep(s=>Math.max(s-1,1));

  // ── Submit ─────────────────────────────────────────────────────────
  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const tok = token || localStorage.getItem('token') || '';
      const b64 = async f => f ? await fileToBase64(f) : '';
      const payload = {
        name:           pers.fullName.trim(),
        email:          cont.email.trim().toLowerCase(),
        phone:          cont.primaryMobile.replace(/\D/g,''),
        altPhone:       cont.alternateMobile.replace(/\D/g,''),
        password:       acc.password,
        adminLevel:     'state',
        assignedState:  terr.assignedState,
        status:         acc.status,
        dateOfBirth:    pers.dateOfBirth,
        gender:         pers.gender,
        fatherName:     pers.fatherName,
        bloodGroup:     pers.bloodGroup,
        nationality:    pers.nationality || 'Indian',
        photoUrl:       await b64(pers.profilePhoto),
        addressLine1:   cont.addressLine1,
        addressLine2:   cont.addressLine2,
        locality:       cont.locality,
        city:           cont.city,
        taluk:          cont.taluk,
        residentialDistrict: cont.residentialDistrict,
        residentialState:    cont.residentialState,
        residentialPincode:  cont.residentialPincode,
        postOffice:     cont.postOffice,
        address:        [cont.addressLine1,cont.addressLine2,cont.locality,cont.city,cont.residentialState,cont.residentialPincode].filter(Boolean).join(', '),
        aadhaarNumber:  kyc.aadhaarNumber.replace(/\s/g,''),
        panNumber:      kyc.panNumber.trim().toUpperCase(),
        aadhaarFrontUrl: await b64(kyc.aadhaarFront),
        aadhaarBackUrl:  await b64(kyc.aadhaarBack),
        panUrl:          await b64(kyc.panDoc),
        addressProofType:   kyc.useAadhaarAsAddressProof ? 'Aadhaar Card' : kyc.addressProofType,
        addressProofNumber: kyc.useAadhaarAsAddressProof ? kyc.aadhaarNumber.replace(/\s/g,'') : kyc.addressProofNumber,
        addressProofUrl:    kyc.useAadhaarAsAddressProof ? await b64(kyc.aadhaarFront) : await b64(kyc.addressProofDoc),
        declarationAccepted: decl
      };
      let res = await fetch(`${API_BASE}/admin/admins`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-auth-token':tok, 'Authorization':`Bearer ${tok}` },
        body: JSON.stringify({ ...payload, adminRole: 'state-admin' })
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data); setStep(7);
        notify(data.msg||'State Administrator created successfully!', 'success');
        if (typeof onSuccess==='function') onSuccess(data);
      } else {
        notify(data.msg||data.message||'Failed to create administrator.', 'error');
      }
    } catch(err) {
      console.error('Create state admin error:', err);
      notify('Network error. Please try again.', 'error');
    } finally { setSaving(false); }
  };

  const pws = pwScore(acc.password);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl my-4"
           style={{animation:'fadeInScale .2s ease'}}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Add State Administrator</h2>
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white">Main Admin Only</span>
            </div>
            {step<=6&&<p className="text-[11px] text-slate-400 font-medium">Step {step} of 6 — {STEPS[step-1]?.label}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 max-h-[72vh] overflow-y-auto">
          {step===7&&result&&<SuccessScreen result={result} onClose={onClose}/>}
          {step<=6&&<StepBar current={step}/>}

          {/* STEP 1: Personal */}
          {step===1&&(
            <div className="space-y-4">
              <SH icon={User} color="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" title="Personal Details" sub="Basic identity information of the State Administrator"/>
              <FG>
                <div>
                  <Lbl req>Full Name</Lbl>
                  <Inp value={pers.fullName} onChange={e=>{upP('fullName',e.target.value);clrErr('fullName');}} placeholder="e.g. Dhanush Tamilarasan" err={errors.fullName}/>
                  <ErrMsg msg={errors.fullName}/>
                </div>
                <div>
                  <Lbl req>Date of Birth</Lbl>
                  <Inp type="date" max={new Date().toISOString().split('T')[0]} value={pers.dateOfBirth} onChange={e=>{upP('dateOfBirth',e.target.value);clrErr('dateOfBirth');}} err={errors.dateOfBirth}/>
                  <ErrMsg msg={errors.dateOfBirth}/>
                </div>
              </FG>
              <FG>
                <div>
                  <Lbl req>Gender</Lbl>
                  <Sel value={pers.gender} onChange={e=>{upP('gender',e.target.value);clrErr('gender');}} err={errors.gender}>
                    <option value="">Select gender…</option>
                    {GENDERS.map(g=><option key={g} value={g}>{g}</option>)}
                  </Sel>
                  <ErrMsg msg={errors.gender}/>
                </div>
                <div>
                  <Lbl>Father / Mother / Spouse Name</Lbl>
                  <Inp value={pers.fatherName} onChange={e=>upP('fatherName',e.target.value)} placeholder="Guardian or spouse name"/>
                </div>
              </FG>
              <FG>
                <div>
                  <Lbl>Blood Group</Lbl>
                  <Sel value={pers.bloodGroup} onChange={e=>upP('bloodGroup',e.target.value)}>
                    <option value="">Select…</option>
                    {BLOOD_GROUPS.map(b=><option key={b} value={b}>{b}</option>)}
                  </Sel>
                </div>
                <div>
                  <Lbl>Nationality</Lbl>
                  <Inp value={pers.nationality} onChange={e=>upP('nationality',e.target.value)} placeholder="e.g. Indian"/>
                </div>
              </FG>
              <UploadBtn label="Profile Photo" value={pers.profilePhoto} onChange={f=>upP('profilePhoto',f)} accept="image/*" optional/>
            </div>
          )}

          {/* STEP 2: Contact & Address */}
          {step===2&&(
            <div className="space-y-4">
              <SH icon={Phone} color="bg-blue-500/10 text-blue-600 dark:text-blue-400" title="Contact & Residential Address" sub="Mobile, email, and permanent residential address"/>
              <FG>
                <div>
                  <Lbl req>Primary Mobile</Lbl>
                  <Inp type="tel" maxLength={10} value={cont.primaryMobile} onChange={e=>{upC('primaryMobile',e.target.value.replace(/\D/g,''));clrErr('primaryMobile');}} placeholder="10-digit mobile" err={errors.primaryMobile}/>
                  <ErrMsg msg={errors.primaryMobile}/>
                </div>
                <div>
                  <Lbl>Alternate Mobile</Lbl>
                  <Inp type="tel" maxLength={10} value={cont.alternateMobile} onChange={e=>{upC('alternateMobile',e.target.value.replace(/\D/g,''));clrErr('alternateMobile');}} placeholder="Optional" err={errors.alternateMobile}/>
                  <ErrMsg msg={errors.alternateMobile}/>
                </div>
              </FG>
              <div>
                <Lbl req>Email Address</Lbl>
                <Inp type="email" value={cont.email} onChange={e=>{upC('email',e.target.value);clrErr('email');}} placeholder="admin@example.com" err={errors.email}/>
                <ErrMsg msg={errors.email}/>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-3">Residential Address</p>
                <div className="space-y-3">
                  <div>
                    <Lbl req>Address Line 1</Lbl>
                    <Inp value={cont.addressLine1} onChange={e=>{upC('addressLine1',e.target.value);clrErr('addressLine1');}} placeholder="House No., Street Name" err={errors.addressLine1}/>
                    <ErrMsg msg={errors.addressLine1}/>
                  </div>
                  <div>
                    <Lbl>Address Line 2</Lbl>
                    <Inp value={cont.addressLine2} onChange={e=>upC('addressLine2',e.target.value)} placeholder="Apartment, Block (optional)"/>
                  </div>
                  <FG>
                    <div>
                      <Lbl>Area / Locality</Lbl>
                      <Inp value={cont.locality} onChange={e=>upC('locality',e.target.value)} placeholder="Colony or Locality"/>
                    </div>
                    <div>
                      <Lbl req>Village / Town / City</Lbl>
                      <Inp value={cont.city} onChange={e=>{upC('city',e.target.value);clrErr('city');}} placeholder="City or Village" err={errors.city}/>
                      <ErrMsg msg={errors.city}/>
                    </div>
                  </FG>
                  <FG>
                    <div><Lbl>Post Office</Lbl><Inp value={cont.postOffice} onChange={e=>upC('postOffice',e.target.value)} placeholder="Post Office name"/></div>
                    <div><Lbl>Taluk / Tehsil</Lbl><Inp value={cont.taluk} onChange={e=>upC('taluk',e.target.value)} placeholder="Taluk or Tehsil"/></div>
                  </FG>
                  <FG>
                    <div><Lbl>District</Lbl><Inp value={cont.residentialDistrict} onChange={e=>upC('residentialDistrict',e.target.value)} placeholder="Residential district"/></div>
                    <div>
                      <Lbl req>State</Lbl>
                      <Sel value={cont.residentialState} onChange={e=>{upC('residentialState',e.target.value);clrErr('residentialState');}} err={errors.residentialState}>
                        <option value="">Select state…</option>
                        {INDIAN_STATES.map(s=><option key={s} value={s}>{s}</option>)}
                      </Sel>
                      <ErrMsg msg={errors.residentialState}/>
                    </div>
                  </FG>
                  <div className="w-48">
                    <Lbl req>Pincode</Lbl>
                    <Inp maxLength={6} value={cont.residentialPincode} onChange={e=>{upC('residentialPincode',e.target.value.replace(/\D/g,''));clrErr('residentialPincode');}} placeholder="6-digit pincode" cls="font-mono" err={errors.residentialPincode}/>
                    <ErrMsg msg={errors.residentialPincode}/>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Territory */}
          {step===3&&(
            <div className="space-y-5">
              <SH icon={Globe} color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title="Territory Assignment" sub="Assign the state this administrator will manage"/>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 mb-1">Role (Fixed)</p>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400"/>
                  <span className="text-base font-black text-indigo-700 dark:text-indigo-300">STATE ADMINISTRATOR</span>
                </div>
                <p className="text-[10px] text-indigo-400 mt-1.5">Only the Main Admin can create State Administrators. This role is fixed.</p>
              </div>
              <div>
                <Lbl req>Assigned State</Lbl>
                <Sel value={terr.assignedState} onChange={e=>{setTerr({assignedState:e.target.value});clrErr('assignedState');}} err={errors.assignedState}>
                  <option value="">Select state to assign…</option>
                  {INDIAN_STATES.map(s=><option key={s} value={s}>{s}</option>)}
                </Sel>
                <ErrMsg msg={errors.assignedState}/>
              </div>
              {terr.assignedState&&(
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-1.5 text-xs">
                  <p className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 mb-1">Access Preview</p>
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold"><CheckCircle className="w-3.5 h-3.5"/>Full access to <strong>{terr.assignedState}</strong></div>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><CheckCircle className="w-3.5 h-3.5"/>Manages Districts, Divisions, Pincodes in {terr.assignedState}</div>
                  <div className="flex items-center gap-2 text-red-500"><AlertCircle className="w-3.5 h-3.5"/>No access to any other state</div>
                </div>
              )}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">⚠ Only one active State Admin per state. If one already exists, creation will be blocked.</p>
              </div>
            </div>
          )}

          {/* STEP 4: KYC */}
          {step===4&&(
            <div className="space-y-4">
              <SH icon={FileText} color="bg-purple-500/10 text-purple-600 dark:text-purple-400" title="Identity & KYC Documents" sub="Aadhaar and PAN are mandatory. Aadhaar stored masked."/>
              {/* Aadhaar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <p className="text-[11px] font-extrabold uppercase text-slate-500 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-blue-500"/>Aadhaar Card *</p>
                <div>
                  <Lbl req>Aadhaar Number</Lbl>
                  <Inp maxLength={12} value={kyc.aadhaarNumber} onChange={e=>{upK('aadhaarNumber',e.target.value.replace(/\D/g,''));clrErr('aadhaarNumber');}} placeholder="12-digit Aadhaar number" cls="font-mono tracking-widest" err={errors.aadhaarNumber}/>
                  {kyc.aadhaarNumber.length>0&&<p className="text-[10px] text-slate-400 mt-1">Will be stored as: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{maskAadhaar(kyc.aadhaarNumber)}</span></p>}
                  <ErrMsg msg={errors.aadhaarNumber}/>
                </div>
                <FG>
                  <UploadBtn label="Aadhaar Front" value={kyc.aadhaarFront} onChange={f=>upK('aadhaarFront',f)} optional/>
                  <UploadBtn label="Aadhaar Back"  value={kyc.aadhaarBack}  onChange={f=>upK('aadhaarBack',f)}  optional/>
                </FG>
              </div>
              {/* PAN */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <p className="text-[11px] font-extrabold uppercase text-slate-500 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-orange-500"/>PAN Card *</p>
                <div>
                  <Lbl req>PAN Number</Lbl>
                  <Inp maxLength={10} value={kyc.panNumber} onChange={e=>{upK('panNumber',e.target.value.toUpperCase());clrErr('panNumber');}} placeholder="ABCDE1234F" cls="font-mono tracking-widest uppercase" err={errors.panNumber}/>
                  <ErrMsg msg={errors.panNumber}/>
                </div>
                <UploadBtn label="PAN Document" value={kyc.panDoc} onChange={f=>upK('panDoc',f)} optional/>
              </div>
              {/* Address Proof */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <p className="text-[11px] font-extrabold uppercase text-slate-500 flex items-center gap-1.5"><Home className="w-3.5 h-3.5 text-emerald-500"/>Address Proof *</p>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input type="checkbox" checked={kyc.useAadhaarAsAddressProof} onChange={e=>{upK('useAadhaarAsAddressProof',e.target.checked);clrErr('addressProofType');}} className="w-4 h-4 rounded accent-primary-600"/>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Use Aadhaar as Address Proof</span>
                </label>
                {!kyc.useAadhaarAsAddressProof&&(
                  <div className="space-y-3">
                    <div>
                      <Lbl req>Document Type</Lbl>
                      <Sel value={kyc.addressProofType} onChange={e=>{upK('addressProofType',e.target.value);clrErr('addressProofType');}} err={errors.addressProofType}>
                        <option value="">Select document…</option>
                        {ADDRESS_PROOF_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                      </Sel>
                      <ErrMsg msg={errors.addressProofType}/>
                    </div>
                    <div><Lbl>Document Number</Lbl><Inp value={kyc.addressProofNumber} onChange={e=>upK('addressProofNumber',e.target.value)} placeholder="Document reference number"/></div>
                    <UploadBtn label="Address Proof Document" value={kyc.addressProofDoc} onChange={f=>upK('addressProofDoc',f)} optional/>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Account */}
          {step===5&&(
            <div className="space-y-5">
              <SH icon={Lock} color="bg-amber-500/10 text-amber-600 dark:text-amber-400" title="Account & Access Setup" sub="Set a temporary initial password for the State Administrator"/>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">📌 Temporary password — State Admin must change it on first login to the Sub-Admin portal.</p>
              </div>
              <div>
                <Lbl req>Initial Password</Lbl>
                <div className="relative">
                  <Inp type={acc.showPw?'text':'password'} value={acc.password} onChange={e=>{upA('password',e.target.value);clrErr('password');}} placeholder="Min 8 chars, uppercase, number and symbol" err={errors.password} cls="pr-10"/>
                  <button type="button" onClick={()=>upA('showPw',!acc.showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                    {acc.showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                  </button>
                </div>
                {acc.password.length>0&&(
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">{[1,2,3,4,5].map(i=><div key={i} className={`h-1 flex-1 rounded-full transition-all ${pws>=i?strengthColor(pws):'bg-slate-200 dark:bg-slate-700'}`}/>)}</div>
                    <p className={`text-[10px] font-bold ${pws<=2?'text-red-500':pws===3?'text-amber-500':'text-emerald-500'}`}>{strengthLabel(pws)}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        {ok:acc.password.length>=8,    l:'8+ characters'},
                        {ok:/[A-Z]/.test(acc.password),l:'Uppercase'},
                        {ok:/[a-z]/.test(acc.password),l:'Lowercase'},
                        {ok:/\d/.test(acc.password),   l:'Number'},
                        {ok:/[^A-Za-z0-9]/.test(acc.password),l:'Special character'}
                      ].map(r=>(
                        <div key={r.l} className={`flex items-center gap-1 text-[10px] font-medium ${r.ok?'text-emerald-600 dark:text-emerald-400':'text-slate-400'}`}>
                          {r.ok?<CheckCircle className="w-3 h-3"/>:<AlertCircle className="w-3 h-3"/>}{r.l}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <ErrMsg msg={errors.password}/>
              </div>
              <div>
                <Lbl req>Confirm Password</Lbl>
                <div className="relative">
                  <Inp type={acc.showCf?'text':'password'} value={acc.confirmPassword} onChange={e=>{upA('confirmPassword',e.target.value);clrErr('confirmPassword');}} placeholder="Re-enter password" err={errors.confirmPassword} cls="pr-10"/>
                  <button type="button" onClick={()=>upA('showCf',!acc.showCf)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                    {acc.showCf?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                  </button>
                </div>
                {acc.confirmPassword&&acc.password===acc.confirmPassword&&(
                  <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3"/>Passwords match</p>
                )}
                <ErrMsg msg={errors.confirmPassword}/>
              </div>
              <div>
                <Lbl req>Account Status</Lbl>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {[
                    {v:'Active',              l:'Active',              s:'Permit login immediately',c:'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'},
                    {v:'Pending Verification',l:'Pending Verification',s:'KYC review required',    c:'border-amber-500 bg-amber-50 dark:bg-amber-900/20'}
                  ].map(opt=>(
                    <label key={opt.v} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${acc.status===opt.v?opt.c:'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                      <input type="radio" name="adminStatus" value={opt.v} checked={acc.status===opt.v} onChange={()=>upA('status',opt.v)} className="mt-0.5"/>
                      <div>
                        <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{opt.l}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{opt.s}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Review */}
          {step===6&&(
            <div className="space-y-4">
              <SH icon={CheckCircle} color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title="Review & Confirm" sub="Verify all details before creating the State Administrator"/>
              <RS title="Personal Details" icon={User} color="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <RR label="Full Name"     value={pers.fullName}/>
                <RR label="Date of Birth" value={pers.dateOfBirth?new Date(pers.dateOfBirth).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):''}/>
                <RR label="Gender"        value={pers.gender}/>
                <RR label="Father / Spouse" value={pers.fatherName}/>
                <RR label="Blood Group"   value={pers.bloodGroup}/>
                <RR label="Nationality"   value={pers.nationality}/>
              </RS>
              <RS title="Contact Details" icon={Phone} color="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <RR label="Primary Mobile"   value={cont.primaryMobile} mono/>
                <RR label="Alternate Mobile" value={cont.alternateMobile} mono/>
                <RR label="Email"            value={cont.email}/>
              </RS>
              <RS title="Residential Address" icon={MapPin} color="bg-slate-500/10 text-slate-600 dark:text-slate-400">
                <RR label="Address" value={[cont.addressLine1,cont.addressLine2].filter(Boolean).join(', ')}/>
                <RR label="City"    value={cont.city}/>
                <RR label="State"   value={cont.residentialState}/>
                <RR label="Pincode" value={cont.residentialPincode} mono/>
              </RS>
              <RS title="Territory Assignment" icon={Globe} color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <RR label="Role"           value="STATE ADMINISTRATOR"/>
                <RR label="Assigned State" value={terr.assignedState}/>
              </RS>
              <RS title="KYC Documents" icon={FileText} color="bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <RR label="Aadhaar"       value={kyc.aadhaarNumber?maskAadhaar(kyc.aadhaarNumber):''} mono/>
                <RR label="Aadhaar Front" value={kyc.aadhaarFront?('Uploaded: '+kyc.aadhaarFront.name):'Not uploaded'}/>
                <RR label="PAN Number"    value={kyc.panNumber} mono/>
                <RR label="Address Proof" value={kyc.useAadhaarAsAddressProof?'Using Aadhaar':kyc.addressProofType}/>
              </RS>
              <RS title="Account Setup" icon={Lock} color="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <RR label="Account Status"    value={acc.status}/>
                <RR label="Password Strength" value={strengthLabel(pws)}/>
              </RS>
              {/* Declaration */}
              <div className={`rounded-2xl border-2 p-4 transition-colors ${errors.declaration?'border-red-400 bg-red-50 dark:bg-red-900/20':'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                  <strong>Declaration:</strong> I confirm the information and documents submitted for this State Administrator onboarding are accurate and complete.
                </p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={decl} onChange={e=>{setDecl(e.target.checked);clrErr('declaration');}} className="w-4 h-4 rounded accent-primary-600"/>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">I confirm the above information is correct.</span>
                </label>
                <ErrMsg msg={errors.declaration}/>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {step<=6&&(
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
            <button type="button" onClick={step===1?onClose:prev}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <ChevronLeft className="w-4 h-4"/>{step===1?'Cancel':'Back'}
            </button>
            <span className="text-[10px] text-slate-400 font-semibold">{step} / 6</span>
            {step<6?(
              <button type="button" onClick={next}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors cursor-pointer">
                Next <ChevronRight className="w-4 h-4"/>
              </button>
            ):(
              <button type="button" onClick={submit} disabled={saving}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors cursor-pointer">
                {saving?(<><Loader2 className="w-4 h-4 animate-spin"/>Creating…</>):(<><CheckCircle className="w-4 h-4"/>Create State Administrator</>)}
              </button>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes fadeInScale{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
};

export default StateAdminOnboardingWizard;

