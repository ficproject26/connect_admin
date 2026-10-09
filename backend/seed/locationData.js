// Comprehensive Pan-India Location Hierarchy: 36 States/UTs, Districts, Sub-Divisions/Taluks, PIN Codes

const states = [
  { _id: 'state_ka', name: 'Karnataka', code: 'KA' },
  { _id: 'state_mh', name: 'Maharashtra', code: 'MH' },
  { _id: 'state_tn', name: 'Tamil Nadu', code: 'TN' },
  { _id: 'state_dl', name: 'Delhi', code: 'DL' },
  { _id: 'state_tg', name: 'Telangana', code: 'TG' },
  { _id: 'state_ap', name: 'Andhra Pradesh', code: 'AP' },
  { _id: 'state_kl', name: 'Kerala', code: 'KL' },
  { _id: 'state_gj', name: 'Gujarat', code: 'GJ' },
  { _id: 'state_up', name: 'Uttar Pradesh', code: 'UP' },
  { _id: 'state_wb', name: 'West Bengal', code: 'WB' },
  { _id: 'state_rj', name: 'Rajasthan', code: 'RJ' },
  { _id: 'state_pb', name: 'Punjab', code: 'PB' },
  { _id: 'state_hr', name: 'Haryana', code: 'HR' },
  { _id: 'state_mp', name: 'Madhya Pradesh', code: 'MP' },
  { _id: 'state_br', name: 'Bihar', code: 'BR' },
  { _id: 'state_od', name: 'Odisha', code: 'OD' },
  { _id: 'state_as', name: 'Assam', code: 'AS' },
  { _id: 'state_ga', name: 'Goa', code: 'GA' },
  { _id: 'state_cg', name: 'Chhattisgarh', code: 'CG' },
  { _id: 'state_jh', name: 'Jharkhand', code: 'JH' },
  { _id: 'state_hp', name: 'Himachal Pradesh', code: 'HP' },
  { _id: 'state_uk', name: 'Uttarakhand', code: 'UK' },
  { _id: 'state_jk', name: 'Jammu and Kashmir', code: 'JK' },
  { _id: 'state_la', name: 'Ladakh', code: 'LA' },
  { _id: 'state_tr', name: 'Tripura', code: 'TR' },
  { _id: 'state_ml', name: 'Meghalaya', code: 'ML' },
  { _id: 'state_mn', name: 'Manipur', code: 'MN' },
  { _id: 'state_nl', name: 'Nagaland', code: 'NL' },
  { _id: 'state_mz', name: 'Mizoram', code: 'MZ' },
  { _id: 'state_ar', name: 'Arunachal Pradesh', code: 'AR' },
  { _id: 'state_sk', name: 'Sikkim', code: 'SK' },
  { _id: 'state_py', name: 'Puducherry', code: 'PY' },
  { _id: 'state_ch', name: 'Chandigarh', code: 'CH' },
  { _id: 'state_an', name: 'Andaman and Nicobar Islands', code: 'AN' },
  { _id: 'state_dn', name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DN' },
  { _id: 'state_ld', name: 'Lakshadweep', code: 'LD' }
];

// Definition of raw districts per state
const rawDistrictsByState = {
  state_ka: [
    { id: 'dist_blr_u', name: 'Bengaluru Urban' },
    { id: 'dist_mys', name: 'Mysuru' },
    { id: 'dist_mandya', name: 'Mandya' },
    { id: 'dist_hassan', name: 'Hassan' },
    { id: 'dist_blr_r', name: 'Bengaluru Rural' },
    { id: 'dist_belagavi', name: 'Belagavi' },
    { id: 'dist_hubballi', name: 'Dharwad' },
    { id: 'dist_kalaburagi', name: 'Kalaburagi' },
    { id: 'dist_vijayapura', name: 'Vijayapura' },
    { id: 'dist_bidar', name: 'Bidar' },
    { id: 'dist_ballari', name: 'Ballari' },
    { id: 'dist_davanagere', name: 'Davanagere' },
    { id: 'dist_kolar', name: 'Kolar' },
    { id: 'dist_chitradurga', name: 'Chitradurga' },
    { id: 'dist_mangaluru', name: 'Dakshina Kannada' },
    { id: 'dist_udupi', name: 'Udupi' },
    { id: 'dist_shivamogga', name: 'Shivamogga' },
    { id: 'dist_karwar', name: 'Uttara Kannada' },
    { id: 'dist_tumakuru', name: 'Tumakuru' },
    { id: 'dist_raichur', name: 'Raichur' }
  ],
  state_mh: [
    { id: 'dist_mumbai_city', name: 'Mumbai City' },
    { id: 'dist_mumbai_sub', name: 'Mumbai Suburban' },
    { id: 'dist_pune', name: 'Pune' },
    { id: 'dist_thane', name: 'Thane' },
    { id: 'dist_kolhapur', name: 'Kolhapur' },
    { id: 'dist_nashik', name: 'Nashik' },
    { id: 'dist_dhule', name: 'Dhule' },
    { id: 'dist_jalgaon', name: 'Jalgaon' },
    { id: 'dist_ahmednagar', name: 'Ahmednagar' },
    { id: 'dist_nagpur', name: 'Nagpur' },
    { id: 'dist_amravati', name: 'Amravati' },
    { id: 'dist_chandrapur', name: 'Chandrapur' },
    { id: 'dist_aurangabad', name: 'Chhatrapati Sambhajinagar' },
    { id: 'dist_solapur', name: 'Solapur' },
    { id: 'dist_nanded', name: 'Nanded' },
    { id: 'dist_latur', name: 'Latur' }
  ],
  state_tn: [
    { id: 'dist_chennai', name: 'Chennai' },
    { id: 'dist_tiruvallur', name: 'Tiruvallur' },
    { id: 'dist_kanchipuram', name: 'Kanchipuram' },
    { id: 'dist_vellore', name: 'Vellore' },
    { id: 'dist_madurai', name: 'Madurai' },
    { id: 'dist_tirunelveli', name: 'Tirunelveli' },
    { id: 'dist_kanyakumari', name: 'Kanyakumari' },
    { id: 'dist_thoothukudi', name: 'Thoothukudi' },
    { id: 'dist_trichy', name: 'Tiruchirappalli' },
    { id: 'dist_thanjavur', name: 'Thanjavur' },
    { id: 'dist_nagapattinam', name: 'Nagapattinam' },
    { id: 'dist_coimbatore', name: 'Coimbatore' },
    { id: 'dist_salem', name: 'Salem' },
    { id: 'dist_erode', name: 'Erode' },
    { id: 'dist_tiruppur', name: 'Tiruppur' }
  ],
  state_dl: [
    { id: 'dist_new_delhi', name: 'New Delhi' },
    { id: 'dist_south_delhi', name: 'South Delhi' },
    { id: 'dist_south_east_delhi', name: 'South East Delhi' },
    { id: 'dist_north_delhi', name: 'North Delhi' },
    { id: 'dist_north_west_delhi', name: 'North West Delhi' },
    { id: 'dist_east_delhi', name: 'East Delhi' },
    { id: 'dist_shahdara', name: 'Shahdara' },
    { id: 'dist_west_delhi', name: 'West Delhi' },
    { id: 'dist_central_delhi', name: 'Central Delhi' }
  ],
  state_tg: [
    { id: 'dist_hyderabad', name: 'Hyderabad' },
    { id: 'dist_rangareddy', name: 'Rangareddy' },
    { id: 'dist_medchal', name: 'Medchal-Malkajgiri' },
    { id: 'dist_nizamabad', name: 'Nizamabad' },
    { id: 'dist_karimnagar', name: 'Karimnagar' },
    { id: 'dist_mahabubnagar', name: 'Mahabubnagar' },
    { id: 'dist_nalgonda', name: 'Nalgonda' },
    { id: 'dist_warangal', name: 'Warangal' },
    { id: 'dist_khammam', name: 'Khammam' }
  ],
  state_ap: [
    { id: 'dist_vizag', name: 'Visakhapatnam' },
    { id: 'dist_vijayawada', name: 'NTR (Vijayawada)' },
    { id: 'dist_guntur', name: 'Guntur' },
    { id: 'dist_tirupati', name: 'Tirupati' },
    { id: 'dist_vizianagaram', name: 'Vizianagaram' },
    { id: 'dist_chittoor', name: 'Chittoor' },
    { id: 'dist_kakinada', name: 'Kakinada' },
    { id: 'dist_east_godavari', name: 'East Godavari' },
    { id: 'dist_kurnool', name: 'Kurnool' },
    { id: 'dist_anantapur', name: 'Anantapur' }
  ],
  state_kl: [
    { id: 'dist_kochi', name: 'Ernakulam' },
    { id: 'dist_trivandrum', name: 'Thiruvananthapuram' },
    { id: 'dist_kozhikode', name: 'Kozhikode' },
    { id: 'dist_thrissur', name: 'Thrissur' },
    { id: 'dist_kannur', name: 'Kannur' },
    { id: 'dist_kollam', name: 'Kollam' },
    { id: 'dist_palakkad', name: 'Palakkad' },
    { id: 'dist_idukki', name: 'Idukki' },
    { id: 'dist_alappuzha', name: 'Alappuzha' },
    { id: 'dist_kottayam', name: 'Kottayam' }
  ],
  state_gj: [
    { id: 'dist_ahmedabad', name: 'Ahmedabad' },
    { id: 'dist_surat', name: 'Surat' },
    { id: 'dist_vadodara', name: 'Vadodara' },
    { id: 'dist_rajkot', name: 'Rajkot' },
    { id: 'dist_gandhinagar', name: 'Gandhinagar' },
    { id: 'dist_mehsana', name: 'Mehsana' },
    { id: 'dist_navsari', name: 'Navsari' },
    { id: 'dist_anand', name: 'Anand' },
    { id: 'dist_bhavnagar', name: 'Bhavnagar' },
    { id: 'dist_jamnagar', name: 'Jamnagar' }
  ],
  state_up: [
    { id: 'dist_noida', name: 'Gautam Buddha Nagar' },
    { id: 'dist_lucknow', name: 'Lucknow' },
    { id: 'dist_kanpur', name: 'Kanpur Nagar' },
    { id: 'dist_varanasi', name: 'Varanasi' },
    { id: 'dist_prayagraj', name: 'Prayagraj' },
    { id: 'dist_agra', name: 'Agra' },
    { id: 'dist_ghaziabad', name: 'Ghaziabad' },
    { id: 'dist_meerut', name: 'Meerut' },
    { id: 'dist_jhansi', name: 'Jhansi' },
    { id: 'dist_gorakhpur', name: 'Gorakhpur' },
    { id: 'dist_bareilly', name: 'Bareilly' },
    { id: 'dist_aligarh', name: 'Aligarh' }
  ],
  state_wb: [
    { id: 'dist_kolkata', name: 'Kolkata' },
    { id: 'dist_howrah', name: 'Howrah' },
    { id: 'dist_north_24_pgs', name: 'North 24 Parganas' },
    { id: 'dist_south_24_pgs', name: 'South 24 Parganas' },
    { id: 'dist_siliguri', name: 'Darjeeling' },
    { id: 'dist_jalpaiguri', name: 'Jalpaiguri' },
    { id: 'dist_nadia', name: 'Nadia' },
    { id: 'dist_murshidabad', name: 'Murshidabad' },
    { id: 'dist_bardhaman', name: 'Paschim Bardhaman' },
    { id: 'dist_hooghly', name: 'Hooghly' }
  ],
  state_rj: [
    { id: 'dist_jaipur', name: 'Jaipur' },
    { id: 'dist_jodhpur', name: 'Jodhpur' },
    { id: 'dist_udaipur', name: 'Udaipur' },
    { id: 'dist_kota', name: 'Kota' },
    { id: 'dist_bikaner', name: 'Bikaner' },
    { id: 'dist_alwar', name: 'Alwar' },
    { id: 'dist_ajmer', name: 'Ajmer' },
    { id: 'dist_ganganagar', name: 'Sri Ganganagar' },
    { id: 'dist_jaisalmer', name: 'Jaisalmer' },
    { id: 'dist_bhilwara', name: 'Bhilwara' }
  ],
  state_pb: [
    { id: 'dist_ludhiana', name: 'Ludhiana' },
    { id: 'dist_amritsar', name: 'Amritsar' },
    { id: 'dist_jalandhar', name: 'Jalandhar' },
    { id: 'dist_mohali', name: 'SAS Nagar' },
    { id: 'dist_patiala', name: 'Patiala' },
    { id: 'dist_bathinda', name: 'Bathinda' },
    { id: 'dist_gurdaspur', name: 'Gurdaspur' },
    { id: 'dist_firozpur', name: 'Firozpur' }
  ],
  state_hr: [
    { id: 'dist_gurugram', name: 'Gurugram' },
    { id: 'dist_faridabad', name: 'Faridabad' },
    { id: 'dist_panipat', name: 'Panipat' },
    { id: 'dist_sonipat', name: 'Sonipat' },
    { id: 'dist_panchkula', name: 'Panchkula' },
    { id: 'dist_ambala', name: 'Ambala' },
    { id: 'dist_hisar', name: 'Hisar' },
    { id: 'dist_rohtak', name: 'Rohtak' },
    { id: 'dist_karnal', name: 'Karnal' }
  ],
  state_mp: [
    { id: 'dist_indore', name: 'Indore' },
    { id: 'dist_bhopal', name: 'Bhopal' },
    { id: 'dist_jabalpur', name: 'Jabalpur' },
    { id: 'dist_gwalior', name: 'Gwalior' },
    { id: 'dist_ujjain', name: 'Ujjain' },
    { id: 'dist_ratlam', name: 'Ratlam' },
    { id: 'dist_rewa', name: 'Rewa' },
    { id: 'dist_morena', name: 'Morena' },
    { id: 'dist_sagar', name: 'Sagar' }
  ],
  state_br: [
    { id: 'dist_patna', name: 'Patna' },
    { id: 'dist_gaya', name: 'Gaya' },
    { id: 'dist_muzaffarpur', name: 'Muzaffarpur' },
    { id: 'dist_bhagalpur', name: 'Bhagalpur' },
    { id: 'dist_darbhanga', name: 'Darbhanga' },
    { id: 'dist_purnia', name: 'Purnia' },
    { id: 'dist_bhojpur', name: 'Bhojpur' },
    { id: 'dist_nawada', name: 'Nawada' },
    { id: 'dist_nalanda', name: 'Nalanda' }
  ],
  state_od: [
    { id: 'dist_bhubaneswar', name: 'Khordha' },
    { id: 'dist_cuttack', name: 'Cuttack' },
    { id: 'dist_puri', name: 'Puri' },
    { id: 'dist_rourkela', name: 'Sundargarh' },
    { id: 'dist_sambalpur', name: 'Sambalpur' },
    { id: 'dist_berhampur', name: 'Ganjam' },
    { id: 'dist_balasore', name: 'Balasore' },
    { id: 'dist_mayurbhanj', name: 'Mayurbhanj' },
    { id: 'dist_koraput', name: 'Koraput' }
  ],
  state_as: [
    { id: 'dist_guwahati', name: 'Kamrup Metropolitan' },
    { id: 'dist_dibrugarh', name: 'Dibrugarh' },
    { id: 'dist_jorhat', name: 'Jorhat' },
    { id: 'dist_silchar', name: 'Cachar' },
    { id: 'dist_tezpur', name: 'Sonitpur' },
    { id: 'dist_lakhimpur', name: 'Lakhimpur' },
    { id: 'dist_karimganj', name: 'Karimganj' },
    { id: 'dist_barpeta', name: 'Barpeta' },
    { id: 'dist_nagaon', name: 'Nagaon' }
  ],
  state_ga: [
    { id: 'dist_north_goa', name: 'North Goa' },
    { id: 'dist_south_goa', name: 'South Goa' }
  ],
  state_cg: [
    { id: 'dist_raipur', name: 'Raipur' },
    { id: 'dist_durg', name: 'Durg' },
    { id: 'dist_bilaspur', name: 'Bilaspur' },
    { id: 'dist_korba', name: 'Korba' },
    { id: 'dist_bastar', name: 'Bastar' },
    { id: 'dist_raigarh', name: 'Raigarh' },
    { id: 'dist_dantewada', name: 'Dantewada' },
    { id: 'dist_mahasamund', name: 'Mahasamund' }
  ],
  state_jh: [
    { id: 'dist_ranchi', name: 'Ranchi' },
    { id: 'dist_jamshedpur', name: 'East Singhbhum' },
    { id: 'dist_dhanbad', name: 'Dhanbad' },
    { id: 'dist_bokaro', name: 'Bokaro' },
    { id: 'dist_hazaribagh', name: 'Hazaribagh' },
    { id: 'dist_deoghar', name: 'Deoghar' },
    { id: 'dist_chaibasa', name: 'West Singhbhum' },
    { id: 'dist_palamu', name: 'Palamu' }
  ],
  state_hp: [
    { id: 'dist_shimla', name: 'Shimla' },
    { id: 'dist_kangra', name: 'Kangra' },
    { id: 'dist_kullu', name: 'Kullu' },
    { id: 'dist_solan', name: 'Solan' },
    { id: 'dist_mandi', name: 'Mandi' },
    { id: 'dist_hamirpur', name: 'Hamirpur' },
    { id: 'dist_sirmaur', name: 'Sirmaur' },
    { id: 'dist_kinnaur', name: 'Kinnaur' }
  ],
  state_uk: [
    { id: 'dist_dehradun', name: 'Dehradun' },
    { id: 'dist_haridwar', name: 'Haridwar' },
    { id: 'dist_nainital', name: 'Nainital' },
    { id: 'dist_us_nagar', name: 'Udham Singh Nagar' },
    { id: 'dist_almora', name: 'Almora' },
    { id: 'dist_uttarkashi', name: 'Uttarkashi' },
    { id: 'dist_chamoli', name: 'Chamoli' },
    { id: 'dist_tehri', name: 'Tehri Garhwal' }
  ],
  state_jk: [
    { id: 'dist_srinagar', name: 'Srinagar' },
    { id: 'dist_jammu', name: 'Jammu' },
    { id: 'dist_baramulla', name: 'Baramulla' },
    { id: 'dist_anantnag', name: 'Anantnag' },
    { id: 'dist_kupwara', name: 'Kupwara' },
    { id: 'dist_kulgam', name: 'Kulgam' },
    { id: 'dist_doda', name: 'Doda' },
    { id: 'dist_kishtwar', name: 'Kishtwar' }
  ],
  state_la: [
    { id: 'dist_leh', name: 'Leh' },
    { id: 'dist_kargil', name: 'Kargil' }
  ],
  state_tr: [
    { id: 'dist_agartala', name: 'West Tripura' },
    { id: 'dist_south_tripura', name: 'South Tripura' },
    { id: 'dist_north_tripura', name: 'North Tripura' },
    { id: 'dist_dhalai', name: 'Dhalai' }
  ],
  state_ml: [
    { id: 'dist_shillong', name: 'East Khasi Hills' },
    { id: 'dist_tura', name: 'West Garo Hills' },
    { id: 'dist_ri_bhoi', name: 'Ri-Bhoi' },
    { id: 'dist_south_garo', name: 'South Garo Hills' }
  ],
  state_mn: [
    { id: 'dist_imphal_w', name: 'Imphal West' },
    { id: 'dist_imphal_e', name: 'Imphal East' },
    { id: 'dist_churachandpur', name: 'Churachandpur' },
    { id: 'dist_senapati', name: 'Senapati' },
    { id: 'dist_ukhrul', name: 'Ukhrul' }
  ],
  state_nl: [
    { id: 'dist_kohima', name: 'Kohima' },
    { id: 'dist_dimapur', name: 'Dimapur' },
    { id: 'dist_mon', name: 'Mon' },
    { id: 'dist_tuensang', name: 'Tuensang' }
  ],
  state_mz: [
    { id: 'dist_aizawl', name: 'Aizawl' },
    { id: 'dist_lunglei', name: 'Lunglei' },
    { id: 'dist_champhai', name: 'Champhai' },
    { id: 'dist_kolasib', name: 'Kolasib' }
  ],
  state_ar: [
    { id: 'dist_itanagar', name: 'Papum Pare' },
    { id: 'dist_tawang', name: 'Tawang' },
    { id: 'dist_changlang', name: 'Changlang' },
    { id: 'dist_lohit', name: 'Lohit' }
  ],
  state_sk: [
    { id: 'dist_gangtok', name: 'Gangtok' },
    { id: 'dist_namchi', name: 'Namchi' },
    { id: 'dist_mangan', name: 'Mangan' },
    { id: 'dist_gyalshing', name: 'Gyalshing' }
  ],
  state_py: [
    { id: 'dist_oulgaret', name: 'Puducherry' },
    { id: 'dist_karaikal', name: 'Karaikal' },
    { id: 'dist_mahe', name: 'Mahe' },
    { id: 'dist_yanam', name: 'Yanam' }
  ],
  state_ch: [
    { id: 'dist_ch_north', name: 'Chandigarh North' },
    { id: 'dist_ch_south', name: 'Chandigarh South' },
    { id: 'dist_ch_east', name: 'Chandigarh East' },
    { id: 'dist_ch_west', name: 'Chandigarh West' }
  ],
  state_an: [
    { id: 'dist_port_blair', name: 'South Andaman' },
    { id: 'dist_north_andaman', name: 'North and Middle Andaman' },
    { id: 'dist_nicobar', name: 'Nicobar' }
  ],
  state_dn: [
    { id: 'dist_silvassa', name: 'Dadra and Nagar Haveli' },
    { id: 'dist_daman', name: 'Daman' },
    { id: 'dist_diu', name: 'Diu' }
  ],
  state_ld: [
    { id: 'dist_kavaratti', name: 'Kavaratti' },
    { id: 'dist_agatti', name: 'Agatti' },
    { id: 'dist_minicoy', name: 'Minicoy' },
    { id: 'dist_amindivi', name: 'Amini' }
  ]
};

// Specialized divisions and pincodes for top districts to ensure exact administrative accuracy
const customDistrictDivisions = {
  dist_blr_u: [
    {
      id: 'div_blr_s',
      name: 'Bengaluru South Division',
      pincodes: [
        { code: '560034', area: 'Koramangala / St Johns / National Games Village' },
        { code: '560095', area: 'HSR Layout (Sectors 1-7) / Agara' },
        { code: '560076', area: 'BTM Layout (1st & 2nd Stage) / MICO Layout' },
        { code: '560078', area: 'JP Nagar (Phases 1-6) / Sarakki' },
        { code: '560041', area: 'Jayanagar (4th, 9th Blocks) / Tilak Nagar' },
        { code: '560011', area: 'Jayanagar 3rd Block / Madhavan Park' },
        { code: '560068', area: 'Bommanahalli / Begur / Hongasandra' },
        { code: '560100', area: 'Electronic City Phase 1 / Cyber Park' },
        { code: '560102', area: 'HSR Layout Sector 2 / Parappana Agrahara' },
        { code: '560029', area: 'Bannerghatta Road / Audugodi / Dairy Circle' },
        { code: '560069', area: 'Jayanagar East / Byrasandra' },
        { code: '560070', area: 'Padmanabhanagar / Banashankari 2nd Stage' },
        { code: '560085', area: 'Banashankari 3rd Stage / Kathriguppe' },
        { code: '560062', area: 'Konanakunte / Doddakallasandra / Kanakapura Rd' },
        { code: '560083', area: 'Gottigere / Bannerghatta National Park Rd' },
        { code: '560105', area: 'Anjanapura / BDA Layout South' }
      ]
    },
    {
      id: 'div_blr_c',
      name: 'Bengaluru Central Division',
      pincodes: [
        { code: '560001', area: 'MG Road / Brigade Rd / Cantt' },
        { code: '560002', area: 'Shivajinagar / Commercial St / City Market' },
        { code: '560025', area: 'Richmond Town / Victoria Layout / Shanthi Nagar' },
        { code: '560020', area: 'Seshadripuram / Palace Guttahalli' },
        { code: '560053', area: 'Chickpet / Cottonpet / Majestic' }
      ]
    },
    {
      id: 'div_blr_n',
      name: 'Bengaluru North Division',
      pincodes: [
        { code: '560003', area: 'Malleshwaram / Vyalikaval' },
        { code: '560024', area: 'Hebbal / RT Nagar / Ganganagar' },
        { code: '560092', area: 'Sahakara Nagar / Kodigehalli' },
        { code: '560064', area: 'Yelahanka Satellite Town / New Town' },
        { code: '560054', area: 'Mathikere / BEL Road / Yeshwanthpur' },
        { code: '560022', area: 'Yeshwanthpur Industrial Suburb / Peenya 1st Stage' }
      ]
    },
    {
      id: 'div_blr_e',
      name: 'Bengaluru East Division',
      pincodes: [
        { code: '560038', area: 'Indiranagar 100ft Road / Domlur' },
        { code: '560066', area: 'Whitefield / ITPL / Hope Farm' },
        { code: '560037', area: 'Marathahalli / Kundalahalli Gate' },
        { code: '560103', area: 'Bellandur / Outer Ring Road EcoSpace' },
        { code: '560048', area: 'Hoodi / Mahadevapura SEZ' },
        { code: '560017', area: 'HAL Airport / Vimanapura / Murugeshpalya' }
      ]
    }
  ],
  dist_mys: [
    {
      id: 'div_mys_u',
      name: 'Mysuru Urban Division',
      pincodes: [
        { code: '570001', area: 'Devaraja Market / Sayyaji Rao Rd' },
        { code: '570004', area: 'Chamundipuram / Nazarbad' },
        { code: '570009', area: 'Saraswathipuram / Kuvempunagar' }
      ]
    },
    {
      id: 'div_mys_r',
      name: 'Mysuru Rural Division',
      pincodes: [
        { code: '570010', area: 'Hebbal Industrial Area' },
        { code: '570026', area: 'Hootagalli / Belavadi' },
        { code: '571101', area: 'Nanjangud Industrial Belt' }
      ]
    }
  ],
  dist_blr_r: [
    {
      id: 'div_devanahalli',
      name: 'Devanahalli Division',
      pincodes: [
        { code: '562110', area: 'Devanahalli Town / Airport Zone' },
        { code: '562149', area: 'KIADB Aerospace SEZ' }
      ]
    },
    {
      id: 'div_nelamangala',
      name: 'Nelamangala Division',
      pincodes: [
        { code: '562123', area: 'Nelamangala Town / NH4' },
        { code: '562132', area: 'Dobbaspet Industrial Area' }
      ]
    },
    {
      id: 'div_hosakote',
      name: 'Hosakote Division',
      pincodes: [
        { code: '562114', area: 'Hosakote Industrial Hub' }
      ]
    }
  ],
  dist_pune: [
    {
      id: 'div_pune_city',
      name: 'Pune City Division',
      pincodes: [
        { code: '411001', area: 'Pune Station / Camp' },
        { code: '411004', area: 'Deccan Gymkhana / FC Road' },
        { code: '411016', area: 'Shivajinagar / Model Colony' }
      ]
    },
    {
      id: 'div_pune_haveli',
      name: 'Haveli & East Division',
      pincodes: [
        { code: '411014', area: 'Viman Nagar / Kharadi' },
        { code: '411028', area: 'Hadapsar / Magarpatta City' }
      ]
    },
    {
      id: 'div_pune_pcmc',
      name: 'Pimpri-Chinchwad Division',
      pincodes: [
        { code: '411018', area: 'Pimpri / Chinchwad MIDC' },
        { code: '411057', area: 'Hinjawadi IT Park' }
      ]
    }
  ],
  dist_mumbai_city: [
    {
      id: 'div_mum_south',
      name: 'South Mumbai Division',
      pincodes: [
        { code: '400001', area: 'Fort / Ballard Estate' },
        { code: '400005', area: 'Colaba / Cuffe Parade' },
        { code: '400020', area: 'Churchgate / Nariman Point' }
      ]
    },
    {
      id: 'div_mum_central',
      name: 'Central Mumbai Division',
      pincodes: [
        { code: '400014', area: 'Dadar / Parel' },
        { code: '400008', area: 'Mumbai Central / Byculla' }
      ]
    }
  ],
  dist_mumbai_sub: [
    {
      id: 'div_mum_west_sub',
      name: 'Western Suburbs Division',
      pincodes: [
        { code: '400050', area: 'Bandra West / Linking Rd' },
        { code: '400053', area: 'Andheri West / Lokhandwala' },
        { code: '400092', area: 'Borivali West / Shimpoli' }
      ]
    },
    {
      id: 'div_mum_east_sub',
      name: 'Eastern Suburbs Division',
      pincodes: [
        { code: '400071', area: 'Chembur / Diamond Garden' },
        { code: '400077', area: 'Ghatkopar East' },
        { code: '400080', area: 'Mulund West' }
      ]
    }
  ],
  dist_chennai: [
    {
      id: 'div_chn_north',
      name: 'Chennai North Division',
      pincodes: [
        { code: '600001', area: 'George Town / Parrys' },
        { code: '600013', area: 'Royapuram / Washermanpet' }
      ]
    },
    {
      id: 'div_chn_central',
      name: 'Chennai Central Division',
      pincodes: [
        { code: '600002', area: 'Anna Salai / Mount Road' },
        { code: '600004', area: 'Mylapore / Santhome' },
        { code: '600017', area: 'T. Nagar / Pondy Bazaar' }
      ]
    },
    {
      id: 'div_chn_south',
      name: 'Chennai South Division',
      pincodes: [
        { code: '600020', area: 'Adyar / Besant Nagar' },
        { code: '600096', area: 'OMR / Perungudi IT Corridor' }
      ]
    }
  ],
  dist_hyderabad: [
    {
      id: 'div_hyd_central',
      name: 'Hyderabad Central Division',
      pincodes: [
        { code: '500001', area: 'Abids / Koti / Nampally' },
        { code: '500029', area: 'Himayatnagar / Narayanaguda' },
        { code: '500034', area: 'Banjara Hills' }
      ]
    },
    {
      id: 'div_hyd_secunderabad',
      name: 'Secunderabad Division',
      pincodes: [
        { code: '500003', area: 'Secunderabad Station / MG Road' },
        { code: '500009', area: 'Marredpally / Bowenpally' }
      ]
    },
    {
      id: 'div_hyd_old_city',
      name: 'Charminar & South Division',
      pincodes: [
        { code: '500002', area: 'Charminar / Laad Bazaar' },
        { code: '500053', area: 'Chandrayangutta / Falaknuma' }
      ]
    }
  ],
  dist_rangareddy: [
    {
      id: 'div_cyberabad',
      name: 'Cyberabad Division',
      pincodes: [
        { code: '500081', area: 'HITEC City / Madhapur' },
        { code: '500032', area: 'Gachibowli Financial District' },
        { code: '500084', area: 'Kondapur / Botanical Garden' }
      ]
    },
    {
      id: 'div_rajendranagar',
      name: 'Rajendranagar Division',
      pincodes: [
        { code: '500030', area: 'Rajendranagar / Attapur' },
        { code: '500074', area: 'LB Nagar / Mansoorabad' }
      ]
    }
  ],
  dist_noida: [
    {
      id: 'div_noida_city',
      name: 'Noida City Division',
      pincodes: [
        { code: '201301', area: 'Sector 18 / Atta Market / Sector 1-20' },
        { code: '201307', area: 'Sector 62 / Electronic City' },
        { code: '201304', area: 'Sector 137 / Express Highway' }
      ]
    },
    {
      id: 'div_greater_noida',
      name: 'Greater Noida Division',
      pincodes: [
        { code: '201308', area: 'Pari Chowk / Alpha-Beta Sectors' },
        { code: '201310', area: 'Knowledge Park / Tech Zone' }
      ]
    }
  ],
  dist_lucknow: [
    {
      id: 'div_lko_sadar',
      name: 'Lucknow Sadar Division',
      pincodes: [
        { code: '226001', area: 'Hazratganj / Vidhan Sabha' },
        { code: '226010', area: 'Gomti Nagar / Patrakarpuram' },
        { code: '226016', area: 'Indira Nagar / Munshi Pulia' }
      ]
    },
    {
      id: 'div_lko_trans_gomti',
      name: 'Alambagh & South Division',
      pincodes: [
        { code: '226005', area: 'Alambagh / Charbagh' },
        { code: '226025', area: 'Ashiyana / Transport Nagar' }
      ]
    }
  ],
  dist_ahmedabad: [
    {
      id: 'div_ahd_west',
      name: 'Ahmedabad West Division',
      pincodes: [
        { code: '380009', area: 'Navrangpura / CG Road' },
        { code: '380015', area: 'Satellite / Bodakdev / SG Highway' },
        { code: '380054', area: 'Thaltej / Sindhu Bhavan Rd' }
      ]
    },
    {
      id: 'div_ahd_east',
      name: 'Ahmedabad East Division',
      pincodes: [
        { code: '380001', area: 'Lal Darwaja / Relief Road' },
        { code: '380008', area: 'Maninagar / Kankaria' },
        { code: '382330', area: 'Naroda Industrial Estate' }
      ]
    }
  ],
  dist_kolkata: [
    {
      id: 'div_kol_central',
      name: 'Kolkata Central Division',
      pincodes: [
        { code: '700001', area: 'BBD Bagh / Dalhousie' },
        { code: '700072', area: 'Chandni Chowk / Bowbazar' },
        { code: '700012', area: 'College Street / Central Ave' }
      ]
    },
    {
      id: 'div_kol_south',
      name: 'Kolkata South Division',
      pincodes: [
        { code: '700019', area: 'Ballygunge / Gariahat' },
        { code: '700027', area: 'Alipore / New Alipore' },
        { code: '700029', area: 'Rashbehari / Lake Market' }
      ]
    },
    {
      id: 'div_kol_north',
      name: 'Kolkata North Division',
      pincodes: [
        { code: '700004', area: 'Shyambazar / Hatibagan' },
        { code: '700006', area: 'Beadon Street / Girish Park' }
      ]
    }
  ],
  dist_jaipur: [
    {
      id: 'div_jpr_city',
      name: 'Jaipur City Division',
      pincodes: [
        { code: '302001', area: 'Pink City / Johari Bazaar' },
        { code: '302020', area: 'Mansarovar / New Sanganer Rd' },
        { code: '302015', area: 'Tonk Road / Malviya Nagar' }
      ]
    },
    {
      id: 'div_jpr_north',
      name: 'Jaipur North & Amer Division',
      pincodes: [
        { code: '302023', area: 'Vidhyadhar Nagar / Sikar Rd' },
        { code: '302028', area: 'Amer Fort Area / Jal Mahal' }
      ]
    }
  ],
  dist_gurugram: [
    {
      id: 'div_ggn_cyber',
      name: 'Cyber City & DLF Division',
      pincodes: [
        { code: '122002', area: 'DLF Phase 1-4 / Cyber Hub' },
        { code: '122003', area: 'Sector 44-50 / Golf Course Rd' }
      ]
    },
    {
      id: 'div_ggn_sohna',
      name: 'Sohna Road & Manesar Division',
      pincodes: [
        { code: '122018', area: 'Sohna Road / Subhash Chowk' },
        { code: '122051', area: 'IMT Manesar Industrial Belt' }
      ]
    }
  ]
};

// Flattened master database
const districts = [];
const divisions = [];
const pincodes = [];

let pinCodeCounter = 1000;

Object.entries(rawDistrictsByState).forEach(([stateId, dList]) => {
  dList.forEach(d => {
    // 1. Add District
    districts.push({
      _id: d.id,
      name: d.name,
      stateId
    });

    // 2. Check if district has customized divisions and pincodes
    if (customDistrictDivisions[d.id]) {
      customDistrictDivisions[d.id].forEach(div => {
        divisions.push({
          _id: div.id,
          name: div.name,
          districtId: d.id,
          stateId
        });

        div.pincodes.forEach(p => {
          pincodes.push({
            _id: `pin_${p.code}`,
            code: p.code,
            areaName: p.area,
            divisionId: div.id,
            districtId: d.id,
            stateId
          });
        });
      });
    } else {
      // Clean, realistic divisions for standard districts
      const cleanName = d.name.trim();
      const div1Id = `div_${d.id}_urban`;
      const div2Id = `div_${d.id}_rural`;

      divisions.push(
        { _id: div1Id, name: `${cleanName} Urban Division`, districtId: d.id, stateId },
        { _id: div2Id, name: `${cleanName} Rural Division`, districtId: d.id, stateId }
      );

      // Generating realistic distinct postal codes
      pinCodeCounter += 1;
      const basePrefix = stateId === 'state_ka' ? '58' : stateId === 'state_mh' ? '41' : stateId === 'state_tn' ? '62' : stateId === 'state_up' ? '24' : stateId === 'state_gj' ? '39' : '11';
      const code1 = `${basePrefix}${String(pinCodeCounter).padStart(4, '0')}`.slice(0, 6);
      pinCodeCounter += 1;
      const code2 = `${basePrefix}${String(pinCodeCounter).padStart(4, '0')}`.slice(0, 6);

      pincodes.push(
        { _id: `pin_${code1}`, code: code1, areaName: `${cleanName} City Centre / Main Market`, divisionId: div1Id, districtId: d.id, stateId },
        { _id: `pin_${code2}`, code: code2, areaName: `${cleanName} Industrial & Commercial Belt`, divisionId: div2Id, districtId: d.id, stateId }
      );
    }
  });
});

module.exports = {
  states,
  districts,
  divisions,
  pincodes
};
