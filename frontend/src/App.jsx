import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, ShieldAlert, FileText, CheckCircle, XCircle, 
  MapPin, Settings, DollarSign, Award, Image, BarChart3, 
  Layers, LogOut, Menu, Sun, Moon, Plus, Edit2, Trash2, 
  Search, Filter, ChevronRight, Download, CreditCard, Clock,
  ArrowUpRight, ArrowDownRight, UserX, AlertTriangle, Eye, EyeOff, UploadCloud, Bell, User,
  Briefcase, Truck, Headphones, Folder, HelpCircle, MessageSquare, Megaphone, ShoppingBag, Calendar, Contact,
  MoreVertical, RotateCcw, LayoutGrid, List, Smartphone, Laptop, Tv, Home, Shirt, Sparkles, Package, Utensils, Tag, Activity, ArrowRight, ChevronLeft
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';

const getBackendUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5001/api';
  const hostname = window.location.hostname;
  // Local development: point to local backend server
  if (
    !hostname || 
    hostname === 'localhost' || 
    hostname === '127.0.0.1' || 
    hostname.startsWith('192.168.') || 
    hostname.startsWith('10.') || 
    hostname.startsWith('172.')
  ) {
    return `http://${hostname || 'localhost'}:5001/api`;
  }
  // Production: use env variable or deployed Render backend
  return import.meta.env.VITE_API_BASE || 'https://connect-admin-96pc.onrender.com/api';
};

const API_BASE = getBackendUrl();

const TAXONOMY = {
  "Services": {
    "Healthcare": ["Hospitals", "Clinics", "Diagnostic Centers", "Pharmacies", "Dental Care", "Eye Care", "Ambulance Services", "Home Nursing", "Health Checkups", "Telemedicine", "Physiotherapy", "Medical Equipment"],
    "Education": ["Schools", "Colleges", "Universities", "Online Courses", "Training Institutes", "Skill Development", "Computer Training", "AI & IT Training", "Language Classes", "Competitive Exam Coaching", "Certification Programs"],
    "Employment": ["Job Portal", "Recruitment Services", "Resume Building", "Interview Preparation", "Career Guidance", "Placement Services", "Internship Programs", "Freelancing Opportunities", "Overseas Jobs"],
    "Financial": ["Banking Services", "Personal Loans", "Home Loans", "Business Loans", "Credit Cards", "Investment Plans", "Mutual Funds", "Financial Consulting", "Tax Planning", "Retirement Planning"],
    "Insurance": ["Health Insurance", "Life Insurance", "Vehicle Insurance", "Travel Insurance", "Property Insurance", "Business Insurance", "Accident Insurance"],
    "Home Services": ["Electrician", "Plumber", "Carpenter", "Painter", "Interior Design", "Home Cleaning", "Pest Control", "AC Repair", "Appliance Repair", "CCTV Installation", "Smart Home Solutions"],
    "Legal": ["Legal Consultation", "Property Registration", "Agreement Drafting", "Notary Services", "Court Assistance", "Company Registration", "Trademark Registration", "Legal Documentation"],
    "Digital": ["Website Development", "Mobile App Development", "UI/UX Design", "Digital Marketing", "SEO Services", "Social Media Marketing", "Graphic Design", "Video Editing", "Cloud Solutions", "Software Development"],
    "Business": ["Company Formation", "GST Registration", "Payroll Management", "HR Solutions", "Recruitment Services", "Business Consulting", "Branding Services", "Franchise Consulting", "Startup Advisory"],
    "Automobile": ["Car Service", "Bike Service", "Car Wash", "Roadside Assistance", "Vehicle Inspection", "Vehicle Insurance", "Driving School", "Vehicle Rental"],
    "Telecom": ["Mobile Recharge", "DTH Recharge", "Broadband Services", "Fiber Internet", "SIM Activation", "Business Connectivity"],
    "Utilities": ["Electricity Bill Payment", "Water Bill Payment", "Gas Booking", "Property Tax", "Internet Bill Payment", "Government Services"],
    "Family": ["Child Care", "Day Care", "Elder Care", "Home Care", "Family Counseling", "Parenting Support"],
    "Fitness": ["Gym Membership", "Yoga Classes", "Personal Training", "Nutrition Consultation", "Wellness Centers", "Spa Services", "Mental Wellness"],
    "Events": ["Wedding Planning", "Birthday Events", "Corporate Events", "Photography", "Videography", "Catering Services", "Decoration Services"],
    "Hospitality": ["Hotels", "Resorts", "Homestays", "Service Apartments", "Luxury Villas", "Corporate Stay"],
    "Travel": ["Flight Booking", "Train Booking", "Bus Booking", "Tour Packages", "Visa Assistance", "Passport Assistance", "Travel Insurance", "Car Rentals", "Holiday Packages"],
    "Real Estate": ["Property Buying", "Property Selling", "Property Rental", "Property Management", "Interior Solutions", "Home Loans"],
    "Security": ["Security Guards", "CCTV Monitoring", "Cyber Security", "Home Security", "Office Security"]
  },
  "Products": {
    "Electronics": ["Smartphones", "Tablets", "Laptops", "Desktop Computers", "Smart Watches", "Headphones", "Earbuds", "Speakers", "Cameras", "Printers", "Computer Accessories"],
    "IT & Office": ["Monitors", "Keyboards", "Mouse", "Webcams", "Routers", "Networking Devices", "Storage Devices", "Office Printers", "Projectors", "UPS & Power Backup"],
    "Home Appliances": ["Refrigerators", "Washing Machines", "Air Conditioners", "Televisions", "Microwave Ovens", "Water Purifiers", "Vacuum Cleaners", "Air Coolers", "Fans", "Geysers"],
    "Furniture": ["Sofas", "Dining Tables", "Beds", "Mattresses", "Wardrobes", "Office Chairs", "Office Tables", "Study Tables", "TV Units", "Shoe Racks"],
    "Fashion": [
      "Men - Shirts", "Men - T-Shirts", "Men - Jeans", "Men - Footwear", "Men - Watches", "Men - Accessories",
      "Women - Sarees", "Women - Kurtis", "Women - Dresses", "Women - Footwear", "Women - Handbags", "Women - Jewelry",
      "Kids - Clothing", "Kids - School Accessories", "Kids - Footwear", "Kids - Toys"
    ],
    "Beauty": ["Skincare", "Haircare", "Cosmetics", "Perfumes", "Grooming Products", "Wellness Products"],
    "Baby Care": ["Baby Food", "Diapers", "Baby Clothing", "Baby Toys", "Baby Care Products", "Baby Accessories"],
    "Sports & Fitness": ["Gym Equipment", "Yoga Accessories", "Sports Wear", "Sports Equipment", "Fitness Trackers", "Cycling Accessories"],
    "Books": ["Academic Books", "Story Books", "Notebooks", "Office Stationery", "Art Supplies", "Educational Materials"],
    "Gaming": ["Gaming Consoles", "Gaming Accessories", "VR Devices", "Gaming Chairs", "Gaming PCs"],
    "Automobile": ["Car Accessories", "Bike Accessories", "Tyres", "Vehicle Care Products", "Safety Equipment", "GPS Devices"],
    "Home & Kitchen": ["Kitchen Appliances", "Cookware", "Storage Containers", "Dining Sets", "Home Decor", "Lighting Products"],
    "Pet Care": ["Pet Food", "Pet Toys", "Pet Accessories", "Pet Grooming Products", "Pet Healthcare"],
    "Gardening": ["Plants", "Gardening Tools", "Outdoor Furniture", "Seeds", "Fertilizers"],
    "Healthcare": ["Medical Equipment", "Health Monitoring Devices", "Wellness Products", "Orthopedic Products", "Personal Health Devices"],
    "Business Products": ["Safety Equipment", "Tools & Machinery", "Office Supplies", "Packaging Materials", "Business Equipment"]
  },
  "Daily Needs": {
    "Grocery": ["Staples", "Rice", "Wheat", "Flour", "Rava", "Pulses", "Dal", "Sugar", "Salt", "Cooking Oil", "Spices", "Packaged Foods", "Biscuits", "Snacks", "Noodles", "Breakfast Cereals", "Ready-to-Eat Foods", "Dry Fruits"],
    "Fruits & Vegetables": ["Fresh Fruits", "Apple", "Banana", "Orange", "Mango", "Grapes", "Pomegranate", "Fresh Vegetables", "Onion", "Tomato", "Potato", "Carrot", "Cabbage", "Green Vegetables"],
    "Dairy": ["Milk", "Curd", "Butter", "Ghee", "Cheese", "Paneer", "Yogurt", "Ice Cream", "Flavored Milk"],
    "Water & Beverages": ["Drinking Water", "Water Cans", "Mineral Water", "RO Water Delivery", "Beverages", "Tea", "Coffee", "Juices", "Soft Drinks", "Energy Drinks", "Health Drinks"],
    "Household Essentials": ["Cleaning Products", "Floor Cleaner", "Toilet Cleaner", "Glass Cleaner", "Disinfectants", "Kitchen Essentials", "Dishwash Liquid", "Scrub Pads", "Aluminum Foil", "Storage Containers", "Utility Items", "Buckets", "Mops", "Dustbins", "Cloth Drying Stands"],
    "Personal Care": ["Bath & Body", "Soap", "Body Wash", "Shampoo", "Conditioner", "Face Wash", "Grooming", "Razor", "Trimmer", "Hair Oil", "Deodorants", "Perfumes", "Oral Care", "Toothpaste", "Toothbrush", "Mouthwash"],
    "Baby Care": ["Baby Diapers", "Baby Wipes", "Baby Powder", "Baby Soap", "Baby Shampoo", "Baby Food", "Feeding Bottles"],
    "Pharmacy": ["Medicines", "OTC Medicines", "Pain Relief Products", "Cold & Cough Remedies", "Healthcare Products", "Thermometer", "BP Monitor", "Glucose Monitor", "First Aid Kit", "Sanitizers", "Face Masks"],
    "Pet Care": ["Dog Food", "Cat Food", "Pet Shampoo", "Pet Toys", "Pet Accessories", "Pet Medicines"],
    "Bakery": ["Bread", "Cakes", "Buns", "Cookies", "Fresh Bakery Items"],
    "Organic Products": ["Organic Vegetables", "Organic Fruits", "Organic Rice", "Organic Spices", "Natural Health Products"],
    "Utility Products": ["Batteries", "Power Banks", "Chargers", "LED Bulbs", "Extension Boards", "Inverters"]
  },
  "Food": {
    "Restaurants": ["Fine Dining", "Family Restaurants", "Casual Dining", "Luxury Restaurants", "Rooftop Restaurants", "Buffet Restaurants", "Theme Restaurants"],
    "Fast Food": ["Burgers", "Pizza", "Sandwiches", "French Fries", "Wraps", "Hot Dogs", "Fried Chicken"],
    "Cafes": ["Coffee Shops", "Tea Cafes", "Dessert Cafes", "Co-working Cafes", "Juice Cafes", "Premium Lounges"],
    "South Indian": ["Idli", "Dosa", "Uttapam", "Pongal", "Vada", "Meals", "Biryani"],
    "North Indian": ["Roti", "Naan", "Paneer Dishes", "Dal Varieties", "Tandoori Items", "Thali Meals"],
    "Biryani": ["Chicken Biryani", "Mutton Biryani", "Veg Biryani", "Dum Biryani", "Fried Rice", "Pulav"],
    "Healthy Food": ["Salads", "Diet Meals", "Protein Meals", "Organic Foods", "Keto Foods", "Vegan Foods"],
    "Bakery": ["Cakes", "Pastries", "Cookies", "Donuts", "Brownies", "Chocolates", "Ice Cream"],
    "Beverages": ["Tea", "Coffee", "Fresh Juice", "Smoothies", "Milkshakes", "Soft Drinks", "Energy Drinks"],
    "International Cuisine": ["Chinese", "Italian", "Mexican", "Thai", "Japanese", "Korean", "Continental"],
    "Non-Veg Specials": ["Chicken", "Mutton", "Fish", "Seafood", "Grill Items", "BBQ"],
    "Vegetarian Specials": ["Pure Veg Restaurants", "Jain Food", "Organic Food", "Traditional Meals"],
    "Home Food": ["Homemade Meals", "Tiffin Services", "Daily Lunch Plans", "Healthy Home Food"],
    "Catering": ["Wedding Catering", "Birthday Catering", "Corporate Catering", "Event Catering", "Bulk Orders"],
    "Subscription Meals": ["Daily Breakfast", "Daily Lunch", "Daily Dinner", "Monthly Meal Plans", "Office Meal Plans"],
    "Premium Dining": ["5-Star Hotels", "Luxury Dining", "Chef Specials", "Exclusive Member Restaurants"]
  },
  "Stay": {
    "Hotels": ["Budget Hotels", "Business Hotels", "Premium Hotels", "Luxury Hotels", "5-Star Hotels", "Airport Hotels", "Boutique Hotels"],
    "Resorts": ["Beach Resorts", "Hill Station Resorts", "Family Resorts", "Luxury Resorts", "Wellness Resorts", "Eco Resorts", "Adventure Resorts"],
    "Homestays": ["Family Homestays", "Village Homestays", "Luxury Homestays", "Farm Stays", "Heritage Homestays"],
    "Service Apartments": ["Daily Rental", "Weekly Rental", "Monthly Rental", "Corporate Apartments", "Family Apartments"],
    "Vacation Rentals": ["Villas", "Holiday Homes", "Farm Houses", "Private Houses", "Weekend Getaways"],
    "Student Accommodation": ["Boys Hostel", "Girls Hostel", "PG Accommodation", "Student Apartments", "College Hostels"],
    "Corporate Stay": ["Business Hotels", "Corporate Guest Houses", "Executive Suites", "Long-Term Business Stay"],
    "Camping & Adventure": ["Tent Camping", "Glamping", "Forest Stay", "Mountain Camps", "Adventure Camps"],
    "Heritage Stay": ["Palace Hotels", "Heritage Resorts", "Traditional Houses", "Cultural Stays"],
    "Couple Stay": ["Honeymoon Resorts", "Romantic Hotels", "Luxury Villas", "Private Pool Villas"],
    "Family Stay": ["Family Hotels", "Family Resorts", "Kid-Friendly Resorts", "Holiday Packages"],
    "Wellness Retreats": ["Yoga Retreats", "Meditation Centers", "Ayurveda Resorts", "Wellness Retreats", "Spa Resorts"],
    "Medical Stay": ["Hospital Guest Houses", "Medical Tourism Stay", "Patient Accommodation", "Caregiver Accommodation"],
    "Religious Stay": ["Temple Guest Houses", "Pilgrimage Hotels", "Spiritual Retreats", "Religious Accommodation"],
    "Rental Accommodation": ["Flats", "Apartments", "Independent Houses", "Shared Accommodation", "Rental Villas"],
    "International Stay": ["International Hotels", "Global Resorts", "Holiday Packages", "Travel Accommodation"]
  },
  "Travel": {
    "Flight Booking": ["Domestic Flights", "International Flights", "One-Way Flights", "Round Trip Flights", "Multi-City Flights", "Business Class", "First Class", "Charter Flights"],
    "Train Booking": ["Express Trains", "Superfast Trains", "Premium Trains", "Tatkal Booking", "Tourist Trains", "Luxury Trains"],
    "Bus Booking": ["Government Buses", "Private Buses", "Sleeper Buses", "AC Buses", "Luxury Coaches", "Volvo Services"],
    "Cab Services": ["Local Taxi", "Airport Transfer", "Outstation Cabs", "Luxury Cars", "Chauffeur Services", "Self-Drive Cars"],
    "Car Rental": ["Self Drive Cars", "Monthly Rental", "Luxury Car Rental", "Corporate Rental", "Tourist Vehicles"],
    "Bike Rental": ["Scooters", "Motorcycles", "Premium Bikes", "Adventure Bikes"],
    "Tour Packages": ["Domestic Tours", "International Tours", "Weekend Trips", "Family Packages", "Group Tours", "Couple Packages"],
    "Honeymoon Packages": ["Beach Destinations", "Hill Stations", "International Honeymoon", "Luxury Honeymoon Resorts"],
    "Family Travel": ["Family Holiday Packages", "Theme Parks", "Resorts", "Family Adventures"],
    "Corporate Travel": ["Business Flights", "Hotel Booking", "Corporate Cab Services", "Employee Travel Management"],
    "Adventure Travel": ["Trekking", "Camping", "Wildlife Safari", "Mountain Climbing", "Water Sports", "Adventure Tours"],
    "Religious Travel": ["Temple Tours", "Pilgrimage Packages", "Spiritual Retreats", "Holy City Tours"],
    "Holiday Packages": ["Beach Holidays", "Hill Station Holidays", "Island Vacations", "Cruise Vacations"],
    "Cruise Travel": ["Domestic Cruises", "International Cruises", "Luxury Cruises", "Family Cruises"],
    "Visa Services": ["Tourist Visa", "Business Visa", "Student Visa", "Work Visa", "Visa Consultation"],
    "Passport Services": ["New Passport", "Renewal", "Tatkal Passport", "Passport Assistance"],
    "International Travel": ["International Flights", "International Hotels", "Global Packages", "Travel Assistance"],
    "Travel Essentials": ["Travel Insurance", "Forex Services", "SIM Cards", "Travel Accessories", "Airport Lounge Access"],
    "Emergency Travel": ["Medical Emergency Travel", "Emergency Ticket Booking", "Travel Support", "Insurance Claims"]
  },
  "Jobs": {
    "Banking": ["Relationship Manager", "Sales Officer", "Branch Operations", "Customer Service Executive", "Credit Analyst", "Loan Officer", "CASA Executive", "Branch Manager", "Wealth Manager", "Commercial Banking"],
    "IT": ["Software Developer", "Full Stack Developer", "Frontend Developer", "Backend Developer", "Mobile App Developer", "UI/UX Designer", "DevOps Engineer", "Cloud Engineer", "Data Analyst", "AI Engineer", "Cyber Security Analyst"],
    "Non-IT": ["Admin Executive", "Office Assistant", "Data Entry Operator", "Operations Executive", "Coordinator", "Receptionist", "Back Office Executive"],
    "BPO": ["Voice Process", "Non-Voice Process", "Customer Support", "Technical Support", "Chat Support", "International Process", "Domestic Process"],
    "Sales & Marketing": ["Sales Executive", "Business Development Executive", "Marketing Executive", "Digital Marketing Executive", "Territory Sales Manager", "Area Sales Manager", "Brand Executive"],
    "Manufacturing": ["Production Operator", "Machine Operator", "Quality Inspector", "Production Supervisor", "Plant Manager", "Maintenance Technician"],
    "Automobile": ["Service Advisor", "Technician", "Sales Consultant", "Workshop Manager", "Spare Parts Executive"],
    "Healthcare": ["Doctors", "Nurses", "Pharmacists", "Lab Technicians", "Medical Representatives", "Hospital Administrators"],
    "Education": ["Teachers", "Professors", "Trainers", "Academic Counselors", "School Administrators", "Placement Officers"],
    "Hospitality": ["Hotel Manager", "Front Office Executive", "Housekeeping Staff", "Chef", "Waiter", "Restaurant Manager"],
    "Travel & Tourism": ["Travel Consultant", "Tour Coordinator", "Ticketing Executive", "Visa Consultant", "Travel Operations Executive"],
    "Real Estate": ["Property Consultant", "Sales Executive", "Site Engineer", "CRM Executive", "Real Estate Manager"],
    "Legal": ["Advocate", "Legal Associate", "Legal Advisor", "Documentation Executive"],
    "Finance": ["Accountant", "Finance Executive", "Tax Consultant", "Auditor", "Chartered Accountant"],
    "Logistics": ["Warehouse Executive", "Logistics Coordinator", "Supply Chain Analyst", "Delivery Executive"],
    "Construction": ["Civil Engineer", "Site Supervisor", "Project Manager", "Architect", "Quantity Surveyor"],
    "Creative": ["Graphic Designer", "Video Editor", "Animator", "Content Writer", "Social Media Manager"],
    "Retail": ["Store Manager", "Cashier", "Retail Sales Executive", "Inventory Executive"],
    "HR & Recruitment": ["HR Executive", "Recruiter", "Talent Acquisition Specialist", "HR Manager"],
    "Government": ["State Government Jobs", "Central Government Jobs", "Railway Jobs", "Defense Jobs", "PSU Jobs"],
    "International": ["Gulf Jobs", "Europe Jobs", "Singapore Jobs", "Malaysia Jobs", "Canada Jobs", "Australia Jobs"],
    "Internships": ["IT Internship", "HR Internship", "Marketing Internship", "Banking Internship", "Finance Internship"],
    "Freelance & Remote": ["Remote Developer", "Remote Designer", "Virtual Assistant", "Freelance Writer", "Online Tutor"]
  }
};

// --- Safe LocalStorage Initialization Helper ---
const getSafeLocalStorageItem = (key, fallbackValue) => {
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined') return fallbackValue;
    return item;
  } catch (e) {
    return fallbackValue;
  }
};

const getSafeParsedLocalStorageItem = (key, fallbackValue) => {
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined') return fallbackValue;
    return JSON.parse(item);
  } catch (e) {
    return fallbackValue;
  }
};

// --- Error Boundary to prevent blank screens ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto my-16 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-800 dark:text-rose-200 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
            <h1 className="text-2xl font-extrabold tracking-tight">Portal Rendering Error</h1>
          </div>
          <p className="text-sm text-rose-600 dark:text-rose-400 mb-4 font-medium">
            An unexpected error occurred during rendering. Please review the details below:
          </p>
          <pre className="text-xs overflow-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-5 rounded-2xl border dark:border-slate-800 max-h-96 font-mono">
            {this.state.error?.stack || this.state.error?.toString()}
          </pre>
          <div className="mt-6 flex gap-3">
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md text-sm"
            >
              Clear Session & Reload
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold px-5 py-2.5 rounded-xl transition-all text-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  // Authentication & Session with safe initializers
  const [token, setToken] = useState(() => getSafeLocalStorageItem('token', ''));
  const [user, setUser] = useState(() => getSafeParsedLocalStorageItem('user', null));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const [onboardType, setOnboardType] = useState('delivery-partner');
  const [showAgentPassword, setShowAgentPassword] = useState(false);
  const [showAgentConfirmPassword, setShowAgentConfirmPassword] = useState(false);
  const [agentViewMode, setAgentViewMode] = useState('list');
  const [pincodeStateFilter, setPincodeStateFilter] = useState('');
  const [pincodeDistrictFilter, setPincodeDistrictFilter] = useState('');
  const [pincodeStatusFilter, setPincodeStatusFilter] = useState('all');

  // Category management cascading/adding states
  const [addFirstCategory, setAddFirstCategory] = useState("Services");
  const [addSecondCategory, setAddSecondCategory] = useState("");
  const [addThirdCategory, setAddThirdCategory] = useState("");
  const [isAddingSecondCategory, setIsAddingSecondCategory] = useState(false);
  const [isAddingThirdCategory, setIsAddingThirdCategory] = useState(false);

  // Category 3-tier layout & selection states
  const [selectedMainCat, setSelectedMainCat] = useState("Products");
  const [selectedSubCat, setSelectedSubCat] = useState("Mobiles & Tablets");
  const [catSearchTerm, setCatSearchTerm] = useState("");
  const [catMainFilter, setCatMainFilter] = useState("All");

  const [bannerImageUrl, setBannerImageUrl] = useState("https://images.unsplash.com/photo-1542838132-92c53300491e?w=600");
  const [bannerVideoUrl, setBannerVideoUrl] = useState("");
  const [catSubFilter, setCatSubFilter] = useState("All");
  const [catStatusFilter, setCatStatusFilter] = useState("All Status");
  const [categoryViewMode, setCategoryViewMode] = useState("cards"); // 'cards' or 'table'
  const [activeCatMenuId, setActiveCatMenuId] = useState(null);
  const [mainCatPage, setMainCatPage] = useState(1);
  const [subCatPage, setSubCatPage] = useState(1);
  const [childCatPage, setChildCatPage] = useState(1);
  const [categoryModalTier, setCategoryModalTier] = useState('sub'); // 'sub' or 'child'
  const [showAddCategoryDropdown, setShowAddCategoryDropdown] = useState(false);

  useEffect(() => {
    if (TAXONOMY[addFirstCategory]) {
      const secondKeys = Object.keys(TAXONOMY[addFirstCategory]);
      if (secondKeys.length > 0) {
        setAddSecondCategory(secondKeys[0]);
        const thirdVals = TAXONOMY[addFirstCategory][secondKeys[0]] || [];
        setAddThirdCategory(thirdVals[0] || "");
      } else {
        setAddSecondCategory("");
        setAddThirdCategory("");
      }
    }
  }, [addFirstCategory]);

  useEffect(() => {
    if (TAXONOMY[addFirstCategory] && TAXONOMY[addFirstCategory][addSecondCategory]) {
      const thirdVals = TAXONOMY[addFirstCategory][addSecondCategory] || [];
      setAddThirdCategory(thirdVals[0] || "");
    } else {
      setAddThirdCategory("");
    }
  }, [addSecondCategory, addFirstCategory]);

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('theme') === 'dark' || 
             (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) {
      return false;
    }
  });

  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Data States
  const [stats, setStats] = useState(null);
  const [branches, setBranches] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pincodes, setPincodes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [banners, setBanners] = useState([]);
  const [ads, setAds] = useState([]);
  const [reports, setReports] = useState([]);
  const [tieups, setTieUps] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  // New States
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [cardHolders, setCardHolders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [supportTeam, setSupportTeam] = useState([]);
  const [categories, setCategories] = useState([]);
  const [queries, setQueries] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  
  // Refined UX States
  const [selectedPlanTab, setSelectedPlanTab] = useState(0);
  const [kycPreviewImage, setKycPreviewImage] = useState(null);
  
  // Pincode Master Lookup States
  const [lookupPincode, setLookupPincode] = useState('');
  const [lookupResults, setLookupResults] = useState([]);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [showOfficeDropdown, setShowOfficeDropdown] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const handlePincodeLookup = async (pin) => {
    setLookupPincode(pin);
    if (pin.length !== 6 || isNaN(pin)) {
      setLookupResults([]);
      setSelectedOffice(null);
      return;
    }
    setLookupLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data && data[0] && data[0].Status === 'Success') {
        setLookupResults(data[0].PostOffice || []);
        setShowOfficeDropdown(true);
      } else {
        setLookupResults([]);
      }
    } catch (err) {
      console.error(err);
      setLookupResults([]);
    } finally {
      setLookupLoading(false);
    }
  };

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterBranch, setFilterBranch] = useState('All');
  const [reportType, setReportType] = useState('revenue');

  // Notification Overlay State
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);

  // Total Orders Search & Filters
  const [ordersSearchTerm, setOrdersSearchTerm] = useState('');
  const [ordersDateFilter, setOrdersDateFilter] = useState('All');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('All');
  const [ordersProductFilter, setOrdersProductFilter] = useState('All');

  // Customers Search & Filters
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerDistrictFilter, setCustomerDistrictFilter] = useState('All');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('All');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('All');

  // Business Tie-Ups Search & Filters
  const [tieupSearchTerm, setTieUpSearchTerm] = useState('');
  const [tieupEntityFilter, setTieUpEntityFilter] = useState('All');

  // Wallet & Withdrawals Filters
  const [withdrawalSearchTerm, setWithdrawalSearchTerm] = useState('');
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState('All');

  // Bookings Search & Filters
  const [bookingSearchTerm, setBookingSearchTerm] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('All');
  const [bookingDateFilter, setBookingDateFilter] = useState('All');

  // Membership Card Holders Search & Filters
  const [cardHolderSearchTerm, setCardHolderSearchTerm] = useState('');
  const [cardHolderTypeFilter, setCardHolderTypeFilter] = useState('All');
  const [cardHolderStatusFilter, setCardHolderStatusFilter] = useState('All');
  const [cardHolderExpiryFilter, setCardHolderExpiryFilter] = useState('All');

  // Payments Search & Filters & Edit Modal
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [paymentDateFilter, setPaymentDateFilter] = useState('All');
  const [editPaymentData, setEditPaymentData] = useState(null);

  // Queries Search & Filters
  const [querySearchTerm, setQuerySearchTerm] = useState('');
  const [queryUserTypeFilter, setQueryUserTypeFilter] = useState('All');
  const [queryStatusFilter, setQueryStatusFilter] = useState('All');

  // Modals / CRUD Actions
  const [showModal, setShowModal] = useState(null); // 'branch', 'admin', 'plan', 'banner', 'ad', 'kyc', 'pincode'
  const [modalData, setModalData] = useState(null);

  // Apply Dark Mode Class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('theme', 'dark'); } catch(e){}
    } else {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('theme', 'light'); } catch(e){}
    }
  }, [darkMode]);

  // Fetch Dashboard Stats & Associated Data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { 'x-auth-token': token, 'Content-Type': 'application/json' };
      
      const fetchTasks = [
        // 1. Dashboard KPIs (Check auth status)
        fetch(`${API_BASE}/admin/dashboard-stats`, { headers }).then(async r => {
          if (r.status === 401 || r.status === 403) {
            handleLogout();
            throw new Error("Unauthorized");
          }
          if (r.ok) setStats(await r.json());
        }),
        // 2. Branches
        fetch(`${API_BASE}/admin/branches`, { headers }).then(async r => { if (r.ok) setBranches(await r.json()); }),
        // 3. Admins
        fetch(`${API_BASE}/admin/admins`, { headers }).then(async r => { if (r.ok) setAdmins(await r.json()); }),
        // 4. Agents
        fetch(`${API_BASE}/admin/agents`, { headers }).then(async r => { if (r.ok) setAgents(await r.json()); }),
        // 5. Pincodes
        fetch(`${API_BASE}/pincodes`, { headers }).then(async r => { if (r.ok) setPincodes(await r.json()); }),
        // 6. Vendors
        fetch(`${API_BASE}/admin/vendors`, { headers }).then(async r => { if (r.ok) setVendors(await r.json()); }),
        // 7. Customers
        fetch(`${API_BASE}/admin/customers`, { headers }).then(async r => { if (r.ok) setCustomers(await r.json()); }),
        // 8. Withdrawals
        fetch(`${API_BASE}/admin/wallet/withdrawals`, { headers }).then(async r => { if (r.ok) setWithdrawals(await r.json()); }),
        // 9. Commissions
        fetch(`${API_BASE}/admin/commissions`, { headers }).then(async r => { if (r.ok) setCommissions(await r.json()); }),
        // 10. Memberships
        fetch(`${API_BASE}/admin/memberships/plans`, { headers }).then(async r => { if (r.ok) setMembershipPlans(await r.json()); }),
        // 11. Banners & Ads
        fetch(`${API_BASE}/admin/banners`, { headers }).then(async r => { if (r.ok) setBanners(await r.json()); }),
        fetch(`${API_BASE}/admin/ads`, { headers }).then(async r => { if (r.ok) setAds(await r.json()); }),
        // 12. Reports
        fetch(`${API_BASE}/admin/reports?type=${reportType}`, { headers }).then(async r => { if (r.ok) setReports(await r.json()); }),
        // 13. Tie-ups & Tasks
        fetch(`${API_BASE}/admin/tie-ups`, { headers }).then(async r => { if (r.ok) setTieUps(await r.json()); }),
        fetch(`${API_BASE}/admin/tasks`, { headers }).then(async r => { if (r.ok) setTasks(await r.json()); }),
        // 14. New endpoints
        fetch(`${API_BASE}/admin/orders`, { headers }).then(async r => { if (r.ok) setOrders(await r.json()); }),
        fetch(`${API_BASE}/admin/bookings`, { headers }).then(async r => { if (r.ok) setBookings(await r.json()); }),
        fetch(`${API_BASE}/admin/jobs`, { headers }).then(async r => { if (r.ok) setJobs(await r.json()); }),
        fetch(`${API_BASE}/admin/card-holders`, { headers }).then(async r => { if (r.ok) setCardHolders(await r.json()); }),
        fetch(`${API_BASE}/admin/payments`, { headers }).then(async r => { if (r.ok) setPayments(await r.json()); }),
        fetch(`${API_BASE}/admin/delivery-partners`, { headers }).then(async r => { if (r.ok) setDeliveryPartners(await r.json()); }),
        fetch(`${API_BASE}/admin/support-team`, { headers }).then(async r => { if (r.ok) setSupportTeam(await r.json()); }),
        fetch(`${API_BASE}/admin/categories`, { headers }).then(async r => { if (r.ok) setCategories(await r.json()); }),
        fetch(`${API_BASE}/admin/queries`, { headers }).then(async r => { if (r.ok) setQueries(await r.json()); }),
        fetch(`${API_BASE}/admin/tickets`, { headers }).then(async r => { if (r.ok) setTickets(await r.json()); }),
        fetch(`${API_BASE}/admin/announcements`, { headers }).then(async r => { if (r.ok) setAnnouncements(await r.json()); }),
      ];

      await Promise.allSettled(fetchTasks);
    } catch (err) {
      console.error("API Server not reachable:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, reportType]);

  // Auth Handling
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      const loginUrl = `${API_BASE}/auth/login`;
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const contentType = res.headers.get('content-type');
      let data = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const textResponse = await res.text();
        throw new Error(`Server returned non-JSON response (URL: ${loginUrl}). Response: ${textResponse.substring(0, 100)}...`);
      }
      
      if (!res.ok) {
        throw new Error(data.msg || data.error || 'Authentication failed');
      }
      if (data.user.role !== 'admin') {
        throw new Error('Access denied. Admin portal only.');
      }
      try {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      } catch (e) {}


      setToken(data.token);
      setUser(data.user);
      setActiveTab('dashboard');
    } catch (err) {
      console.error("API Login failed:", err.message);
      setAuthError(err.message || 'Invalid Credentials or Connection Refused');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (e) {}
    setToken('');
    setUser(null);
  };

  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    const text = typeof message === 'object' ? (message.message || message.text) : message;
    const msgType = typeof message === 'object' ? (message.type || type) : type;
    const newToast = { id, text, type: msgType };
    setToasts(prev => [...prev.slice(-4), newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // API Action Mutators
  const executeAction = async (endpoint, method = 'POST', body = null) => {
    try {
      const headers = { 'x-auth-token': token };
      if (body) {
        headers['Content-Type'] = 'application/json';
      }
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.msg || data.error || "Action failed.", 'error');
        return { success: false, data };
      }
      fetchData();
      return { success: true, data };
    } catch (err) {
      console.error("API action failed:", err);
      addToast("API Action failed: Server unreachable or request rejected.", 'error');
      return { success: false };
    }
  };

  // Mock Exports
  const handleExport = (format) => {
    addToast(`Generating and downloading ${reportType}_report.${format} ...`, 'info');
  };

  if (!user) {
    // LOGIN SCREEN (Rich styling with Harmony palette, modern cards, and shadow styling)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary-600 rounded-full filter blur-[150px] opacity-20 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full filter blur-[150px] opacity-20 pointer-events-none"></div>
        
        <div className="w-full max-w-md bg-slate-800/40 border border-slate-700/60 p-8 rounded-3xl backdrop-blur-xl shadow-2xl relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4 overflow-hidden">
              <img src="/logo.jpg" alt="Forge India Connect Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">Forge India Connect</h1>
            <p className="text-slate-400 mt-2">Super Admin & District Admin Portal</p>
          </div>

          {authError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl mb-6 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@example.com"
                required
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg hover:shadow-primary-500/20 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Quick Login Assist Info */}
          <div className="mt-8 pt-6 border-t border-slate-700/40 text-center">
            <p className="text-xs text-slate-400 mb-2 font-medium">Demo Credentials</p>
            <div className="grid grid-cols-3 gap-1.5 text-[9px]">
              <div className="bg-slate-900/40 p-1.5 rounded-lg border border-slate-700/20">
                <span className="block text-primary-400 font-bold font-semibold">Super Admin</span>
                <span className="block break-all">admin@example.com</span>
                <span className="block text-slate-400 font-mono">admin123</span>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded-lg border border-slate-700/20">
                <span className="block text-purple-400 font-bold font-semibold">District Admin</span>
                <span className="block break-all">north@example.com</span>
                <span className="block text-slate-400 font-mono">admin123</span>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded-lg border border-slate-700/20">
                <span className="block text-emerald-400 font-bold font-semibold">Agent App</span>
                <span className="block break-all">amit@example.com</span>
                <span className="block text-slate-400 font-mono">password123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Super Admin vs Branch Admin menu filters
  const isSuperAdmin = user.adminRole === 'super-admin';

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950 transition-colors duration-200">
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white border-r border-slate-800 transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-0 lg:-translate-x-full'} lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}>
        <div className="h-full flex flex-col justify-between py-6 px-4 overflow-hidden">
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-3 px-2 mb-8 shrink-0">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg overflow-hidden shrink-0">
                <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="block text-sm font-bold tracking-wide">Forge India</span>
                <span className="text-[10px] text-slate-400 capitalize">{(user?.adminRole || '').replace('-', ' ')}</span>
              </div>
            </div>

            <nav className="space-y-1 overflow-y-auto flex-1 pr-1">
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'dashboard' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Layers className="w-4 h-4" /> Dashboard
              </button>

              {isSuperAdmin && (
                <>
                  <button 
                    onClick={() => setActiveTab('branches')} 
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'branches' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
                  >
                    <MapPin className="w-4 h-4" /> District Management
                  </button>
                  
                  <button 
                    onClick={() => setActiveTab('admins')} 
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'admins' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
                  >
                    <UserCheck className="w-4 h-4" /> Admin Management
                  </button>
                </>
              )}

              <button 
                onClick={() => setActiveTab('agents')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'agents' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Users className="w-4 h-4" /> Agent Directory
              </button>

              <button 
                onClick={() => setActiveTab('pincodes')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'pincodes' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <MapPin className="w-4 h-4" /> Pincode Management
              </button>

              <button 
                onClick={() => setActiveTab('vendors')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'vendors' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Layers className="w-4 h-4" /> Vendor Directory
              </button>

              <button 
                onClick={() => setActiveTab('customers')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'customers' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Users className="w-4 h-4" /> Customers
              </button>

              <button 
                onClick={() => setActiveTab('kyc')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'kyc' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <FileText className="w-4 h-4" /> KYC Verification
              </button>

              <button 
                onClick={() => setActiveTab('tieups')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'tieups' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Layers className="w-4 h-4" /> Business Tie-ups
              </button>

              <button 
                onClick={() => setActiveTab('tasks')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'tasks' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <CheckCircle className="w-4 h-4" /> Agent Tasks
              </button>

              <button 
                onClick={() => setActiveTab('wallet')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'wallet' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <DollarSign className="w-4 h-4" /> Wallet & Withdrawals
              </button>

              {isSuperAdmin && (
                <>
                  <button 
                    onClick={() => setActiveTab('commissions')} 
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'commissions' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
                  >
                    <CreditCard className="w-4 h-4" /> Commissions Config
                  </button>

                  <button 
                    onClick={() => setActiveTab('memberships')} 
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'memberships' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
                  >
                    <Award className="w-4 h-4" /> Membership Plans
                  </button>

                  <button 
                    onClick={() => setActiveTab('banners')} 
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'banners' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
                  >
                    <Image className="w-4 h-4" /> Banner Management
                  </button>
                </>
              )}

              <button 
                onClick={() => setActiveTab('reports')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'reports' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <BarChart3 className="w-4 h-4" /> Business Reports
              </button>

              <button 
                onClick={() => setActiveTab('orders')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'orders' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <ShoppingBag className="w-4 h-4" /> Total Orders
              </button>

              <button 
                onClick={() => setActiveTab('bookings')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'bookings' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Calendar className="w-4 h-4" /> Bookings
              </button>

              <button 
                onClick={() => setActiveTab('jobs')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'jobs' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Briefcase className="w-4 h-4" /> Job Applied
              </button>

              <button 
                onClick={() => setActiveTab('card-holders')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'card-holders' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Contact className="w-4 h-4" /> Membership Card
              </button>

              <button 
                onClick={() => setActiveTab('payments')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'payments' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <CreditCard className="w-4 h-4" /> Payments
              </button>

              <button 
                onClick={() => setActiveTab('delivery-partners')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'delivery-partners' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Truck className="w-4 h-4" /> Delivery Partners
              </button>

              <button 
                onClick={() => setActiveTab('technicians')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'technicians' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Contact className="w-4 h-4" /> Technicians
              </button>

              <button 
                onClick={() => setActiveTab('executives')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'executives' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <UserCheck className="w-4 h-4" /> Executives
              </button>

              <button 
                onClick={() => setActiveTab('support-team')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'support-team' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Headphones className="w-4 h-4" /> Customer Support Team
              </button>

              <button 
                onClick={() => setActiveTab('categories')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'categories' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Folder className="w-4 h-4" /> Category Management
              </button>

              <button 
                onClick={() => setActiveTab('queries')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'queries' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <HelpCircle className="w-4 h-4" /> Queries
              </button>

              <button 
                onClick={() => setActiveTab('tickets')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'tickets' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <MessageSquare className="w-4 h-4" /> Support
              </button>

              <button 
                onClick={() => setActiveTab('announcements')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'announcements' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Megaphone className="w-4 h-4" /> Announcements
              </button>

              <button 
                onClick={() => setActiveTab('settings')} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === 'settings' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
              >
                <Settings className="w-4 h-4" /> System Settings
              </button>
            </nav>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        
        {/* HEADER BAR */}
        <header className="h-20 glass sticky top-0 z-20 px-8 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-slate-500 dark:text-slate-400 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-xl font-extrabold capitalize text-slate-900 dark:text-white tracking-tight">
                {activeTab === 'branches' ? 'districts' : activeTab.replace('-', ' ')}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5 hidden sm:block">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Syncing Indicator */}
            {loading && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold animate-pulse">
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Syncing...</span>
              </div>
            )}

            {/* Dark Mode toggle button */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 transition-all shadow-sm active:scale-95 cursor-pointer relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              </button>

              {showNotificationsPanel && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Notifications</h4>
                    <span className="text-[10px] bg-primary-500/10 text-primary-500 font-bold px-2 py-0.5 rounded-full">
                      {agents.filter(a => a.status === 'pending').length + vendors.filter(v => v.status?.toLowerCase() === 'pending').length} New
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2">
                    {agents.filter(a => a.status === 'pending').map(a => (
                      <div key={a._id} onClick={() => { setActiveTab('kyc'); setShowNotificationsPanel(false); }} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Agent KYC Pending</span>
                          <span className="text-[10px] text-amber-500 font-semibold">Verify</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{a.name} submitted KYC documents for approval.</p>
                      </div>
                    ))}
                    {vendors.filter(v => v.status?.toLowerCase() === 'pending').map(v => (
                      <div key={v._id} onClick={() => { setActiveTab('vendors'); setShowNotificationsPanel(false); }} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Vendor Tie-Up Pending</span>
                          <span className="text-[10px] text-amber-500 font-semibold">Review</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{v.businessName} requested vendor registration.</p>
                      </div>
                    ))}
                    {agents.filter(a => a.status === 'pending').length === 0 && vendors.filter(v => v.status?.toLowerCase() === 'pending').length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        No new notifications
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Widget */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => setActiveTab('settings')}
                className="w-9 h-9 rounded-full bg-primary-500 hover:bg-primary-600 flex items-center justify-center font-bold text-white text-sm shadow-sm transition-colors cursor-pointer"
                title="View Profile"
              >
                {(user?.name || '').charAt(0)}
              </button>
              <div className="hidden md:block text-left">
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{user?.name || 'Super Admin'}</span>
                <span className="block text-[10px] text-slate-400 font-medium capitalize">{(user?.adminRole || 'Admin User').replace('-', ' ')}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="ml-1 p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* PAGE VIEWS */}
        <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
          


          {/* 1. DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            stats ? (
              <div className="max-w-7xl mx-auto space-y-6">
              
              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { 
                    title: 'Total Revenue', 
                    value: `₹${stats.kpis.totalRevenue.toLocaleString()}`, 
                    change: '+12.4% vs last mo', 
                    icon: DollarSign, 
                    cardBg: 'bg-emerald-50 dark:bg-emerald-950/20', 
                    borderColor: 'border-emerald-100 dark:border-emerald-900/30',
                    titleColor: 'text-emerald-700 dark:text-emerald-400', 
                    valueColor: 'text-emerald-900 dark:text-emerald-300', 
                    changeColor: 'text-emerald-600/80 dark:text-emerald-500',
                    iconColor: 'text-emerald-600'
                  },
                  { 
                    title: 'Total Orders', 
                    value: stats.kpis.totalOrders, 
                    change: '+8.2% vs last mo', 
                    icon: FileText, 
                    cardBg: 'bg-blue-50 dark:bg-blue-950/20', 
                    borderColor: 'border-blue-100 dark:border-blue-900/30',
                    titleColor: 'text-blue-700 dark:text-blue-400', 
                    valueColor: 'text-blue-900 dark:text-blue-300', 
                    changeColor: 'text-blue-600/80 dark:text-blue-500',
                    iconColor: 'text-blue-600'
                  },
                  { 
                    title: 'Total Agents', 
                    value: stats.kpis.totalAgents, 
                    change: `${stats.kpis.pendingAgentApprovals} pending approval`, 
                    icon: Users, 
                    cardBg: 'bg-purple-50 dark:bg-purple-950/20', 
                    borderColor: 'border-purple-100 dark:border-purple-900/30',
                    titleColor: 'text-purple-700 dark:text-purple-400', 
                    valueColor: 'text-purple-900 dark:text-purple-300', 
                    changeColor: 'text-purple-600/80 dark:text-purple-500',
                    iconColor: 'text-purple-600'
                  },
                  { 
                    title: 'Total Vendors', 
                    value: stats.kpis.totalVendors, 
                    change: `${stats.kpis.pendingVendorApprovals} pending approval`, 
                    icon: Award, 
                    cardBg: 'bg-amber-50 dark:bg-amber-950/20', 
                    borderColor: 'border-amber-100 dark:border-amber-900/30',
                    titleColor: 'text-amber-700 dark:text-amber-400', 
                    valueColor: 'text-amber-900 dark:text-amber-300', 
                    changeColor: 'text-amber-600/80 dark:text-amber-500',
                    iconColor: 'text-amber-600'
                  }
                ].map((kpi, idx) => (
                  <div key={idx} className={`${kpi.cardBg} p-6 rounded-3xl shadow-sm border ${kpi.borderColor} flex items-center justify-between hover:scale-[1.02] transition-all hover:shadow-md`}>
                    <div>
                      <span className={`block text-xs font-extrabold uppercase tracking-wider ${kpi.titleColor}`}>{kpi.title}</span>
                      <span className={`block text-3xl font-black mt-2.5 ${kpi.valueColor}`}>{kpi.value}</span>
                      <span className={`block text-xs font-semibold mt-2 ${kpi.changeColor}`}>{kpi.change}</span>
                    </div>
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-md border border-slate-100 dark:border-slate-700 shrink-0">
                      <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Extra KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { 
                    label: 'Agent Pending KYC', 
                    val: stats.kpis.pendingAgentKYC ?? 0, 
                    bg: 'bg-rose-50/50 dark:bg-rose-950/10',
                    border: 'border-rose-100 dark:border-rose-900/30',
                    text: 'text-rose-600 dark:text-rose-400' 
                  },
                  { 
                    label: 'Vendor Pending KYC', 
                    val: stats.kpis.pendingVendorKYC ?? 0, 
                    bg: 'bg-orange-50/50 dark:bg-orange-950/10',
                    border: 'border-orange-100 dark:border-orange-900/30',
                    text: 'text-orange-600 dark:text-orange-400' 
                  },
                  { 
                    label: 'State Agent', 
                    val: stats.kpis.stateAgents ?? 0, 
                    bg: 'bg-blue-50/50 dark:bg-blue-950/10',
                    border: 'border-blue-100 dark:border-blue-900/30',
                    text: 'text-blue-600 dark:text-blue-400' 
                  },
                  { 
                    label: 'District Agent', 
                    val: stats.kpis.districtAgents ?? 0, 
                    bg: 'bg-indigo-50/50 dark:bg-indigo-950/10',
                    border: 'border-indigo-100 dark:border-indigo-900/30',
                    text: 'text-indigo-600 dark:text-indigo-400' 
                  },
                  { 
                    label: 'Sub District Agent', 
                    val: stats.kpis.subDistrictAgents ?? 0, 
                    bg: 'bg-violet-50/50 dark:bg-violet-950/10',
                    border: 'border-violet-100 dark:border-violet-900/30',
                    text: 'text-violet-600 dark:text-violet-400' 
                  },
                  { 
                    label: 'Pincode Agent', 
                    val: stats.kpis.pincodeAgents ?? 0, 
                    bg: 'bg-purple-50/50 dark:bg-purple-950/10',
                    border: 'border-purple-100 dark:border-purple-900/30',
                    text: 'text-purple-600 dark:text-purple-400' 
                  }
                ].map((sub, sIdx) => (
                  <div 
                    key={sIdx} 
                    className={`${sub.bg} border ${sub.border} p-4 rounded-2xl shadow-sm text-center flex flex-col justify-center items-center hover:scale-[1.03] transition-all duration-300 hover:shadow-md`}
                  >
                    <span className="block text-2xl font-black text-slate-800 dark:text-white">{sub.val}</span>
                    <span className={`block text-[11px] font-extrabold mt-1.5 uppercase tracking-wider leading-tight ${sub.text}`}>
                      {sub.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Revenue Trend Area Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Revenue Overview</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.charts.revenueOverview}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category Wise Revenue Pie Chart */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Category Wise Revenue</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.charts.categoryWiseRevenue}
                          cx="50%"
                          cy="55%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          nameKey="category"
                        >
                          {stats.charts.categoryWiseRevenue.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} iconSize={10} fontSize={11} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Branch Wise Revenue (Super Admin exclusive comparison) */}
              {isSuperAdmin && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">District Wise Performance</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.charts.branchWiseRevenue}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Recent Notifications / Approvals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Pending Approvals */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Action Items</h3>
                    <span className="bg-rose-500/10 text-rose-500 text-xs px-2 py-0.5 rounded-full font-bold">Alert</span>
                  </div>
                  <div className="space-y-3">
                    {agents.filter(a => a.status === 'pending').map((pAgent, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-850">
                        <div>
                          <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">{pAgent.name}</span>
                          <span className="text-xs text-slate-400">Agent KYC Pending • {pAgent.assignedDistrict}</span>
                        </div>
                        <button 
                          onClick={() => { setActiveTab('kyc') }}
                          className="bg-primary-600 hover:bg-primary-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                        >
                          Verify KYC
                        </button>
                      </div>
                    ))}
                    {vendors.filter(v => v.status?.toLowerCase() === 'pending').map((pVendor, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-850">
                        <div>
                          <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">{pVendor.businessName}</span>
                          <span className="text-xs text-slate-400">New Vendor Tie-Up • {pVendor.category}</span>
                        </div>
                        <button 
                          onClick={() => { setActiveTab('vendors') }}
                          className="bg-primary-600 hover:bg-primary-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                        >
                          Approve
                        </button>
                      </div>
                    ))}
                    {agents.filter(a => a.status === 'pending').length === 0 && vendors.filter(v => v.status?.toLowerCase() === 'pending').length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-sm">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        No pending approvals!
                      </div>
                    )}
                  </div>
                </div>

                {/* Latest Activity Log */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Latest Platform Activity</h3>
                  <div className="space-y-4">
                    {stats.recent.latestVendors.slice(0, 3).map((v, idx) => (
                      <div key={idx} className="flex gap-3 items-start text-sm">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                          <Award className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-850 dark:text-slate-200">
                            Vendor tie-up <span className="text-primary-500">{v.businessName}</span> submitted.
                          </p>
                          <span className="text-[10px] text-slate-400">Category: {v.category}</span>
                        </div>
                      </div>
                    ))}
                    {stats.recent.latestAgents.slice(0, 2).map((a, idx) => (
                      <div key={idx} className="flex gap-3 items-start text-sm">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-850 dark:text-slate-200">
                            New agent onboarding: <span className="text-purple-500">{a.name}</span> ({a.email})
                          </p>
                          <span className="text-[10px] text-slate-400">Level: {a.level}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                <p>Loading dashboard data or server is unavailable...</p>
              </div>
            )
          )}

          {/* 2. BRANCH MANAGEMENT */}
          {activeTab === 'branches' && isSuperAdmin && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl w-80">
                  <Search className="w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search districts..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent focus:outline-none text-sm w-full"
                  />
                </div>
                <button 
                  onClick={() => { setModalData(null); setShowModal('branch'); }}
                  className="bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Add District
                </button>
              </div>

              {/* Branch list table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="px-6 py-4">District Details</th>
                      <th className="px-6 py-4">Code</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {branches
                      .filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((b) => (
                        <tr key={b._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="px-6 py-4">
                            <span className="block font-bold text-slate-850 dark:text-slate-100">{b.name}</span>
                            <span className="text-xs text-slate-400">{b.address}</span>
                            {b.agentId && (
                              <span className="inline-flex mt-1.5 text-[10px] bg-primary-500/10 text-primary-500 font-bold px-2 py-0.5 rounded-md">
                                Agent: {b.agentId.name || b.agentId}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono font-semibold text-slate-600 dark:text-slate-400">{b.code}</td>
                          <td className="px-6 py-4">{b.city}, {b.state}</td>
                          <td className="px-6 py-4">{b.contactNumber}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${b.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                              {b.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button 
                              onClick={() => { setModalData(b); setShowModal('branch'); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => executeAction(`/admin/branches/${b._id}`, 'DELETE')}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. ADMIN USER MANAGEMENT */}
          {activeTab === 'admins' && isSuperAdmin && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Administrators & Permissions</h3>
                <button 
                  onClick={() => { setModalData(null); setShowModal('admin'); }}
                  className="bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md"
                >
                  <Plus className="w-4 h-4" /> Add Admin User
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {admins.map((adm) => (
                  <div key={adm._id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-850 dark:text-slate-100">{adm.name}</span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${adm.adminRole === 'super-admin' ? 'bg-amber-500/10 text-amber-500' : 'bg-purple-500/10 text-purple-500'}`}>
                          {adm.adminRole}
                        </span>
                      </div>
                      <span className="block text-xs text-slate-400 mt-1">{adm.email}</span>
                      {adm.branchId && (
                        <span className="inline-block bg-slate-100 dark:bg-slate-800 text-xs px-2.5 py-1 rounded-md font-semibold mt-3">
                          Assigned District: {adm.branchId.name || adm.branchId}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setModalData(adm); setShowModal('admin'); }}
                        className="p-2 text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => executeAction(`/admin/admins/${adm._id}`, 'DELETE')}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. AGENTS DIRECTORY */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              
              {/* Agent Performance Analytics Dashboard */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Agent Network Performance</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-black text-primary-500">{agents.length}</span>
                    <span className="text-xs text-slate-400 mt-1">Total Network Agents</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-black text-emerald-500">
                      ₹{agents.reduce((sum, a) => sum + (a.commissionEarned || 0), 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">Total Commissions Disbursed</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-black text-purple-500">
                      {agents.reduce((sum, a) => sum + (a.vendorsAdded || 0), 0)}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">Vendors Onboarded By Agents</span>
                  </div>
                </div>
              </div>

              {/* Agent Grid / Directory */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="flex gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl flex-1 border border-slate-200/60 dark:border-slate-850 w-full sm:max-w-md">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search by name, email, pincode..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent focus:outline-none text-sm w-full"
                    />
                  </div>
                  <div className="flex gap-3 items-center w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button 
                        type="button"
                        onClick={() => setAgentViewMode('list')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${agentViewMode === 'list' ? 'bg-white dark:bg-slate-900 text-slate-850 dark:text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                      >
                        List
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAgentViewMode('grid')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${agentViewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-slate-855 dark:text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                      >
                        Grid
                      </button>
                    </div>
                    <button 
                      onClick={() => { setModalData(null); setShowModal('create-agent'); }}
                      className="bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 text-xs"
                    >
                      <Plus className="w-4 h-4" /> Add Agent
                    </button>
                  </div>
                </div>

                {agentViewMode === 'list' ? (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {agents
                      .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.email.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((agent) => (
                        <div key={agent._id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                          <div 
                            onClick={() => { setModalData(agent); setShowModal('agent-details'); }}
                            className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-1 cursor-pointer"
                          >
                            <div className="flex gap-4">
                              <img src={agent.kyc?.selfie || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} alt="" className="w-12 h-12 rounded-xl object-cover" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-850 dark:text-slate-100 hover:text-primary-500 transition-colors">{agent.name}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${agent.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                    {agent.status}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 mt-1 space-x-2">
                                  <span>{agent.phone}</span>
                                  <span>•</span>
                                  <span>{agent.email}</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs">
                              <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-850">
                                <span className="block text-slate-400 capitalize">{agent.level || 'pincode'}</span>
                                <span className="font-bold">
                                  {agent.level === 'pincode' || !agent.level 
                                    ? (agent.assignedPincode?.code || 'None') 
                                    : (agent.assignedArea || 'None')}
                                </span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-850">
                                <span className="block text-slate-400">Wallet</span>
                                <span className="font-bold text-emerald-500">₹{agent.balance || 0}</span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-850">
                                <span className="block text-slate-400">Vendors</span>
                                <span className="font-bold">{agent.vendorsAdded || 0}</span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-850">
                                <span className="block text-slate-400">Commission</span>
                                <span className="font-bold">₹{agent.commissionEarned || 0}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => { setModalData({ agentId: agent._id }); setShowModal('assign-task'); }}
                              className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                            >
                              Assign Task
                            </button>
                            <button 
                              onClick={() => { setModalData(agent); setShowModal('edit-agent'); }}
                              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                            >
                              Edit
                            </button>
                            {agent.status === 'approved' ? (
                              <button 
                                onClick={() => executeAction(`/admin/approve-agent/${agent._id}`, 'PUT', { status: 'suspended' })}
                                className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                              >
                                Suspend
                              </button>
                            ) : (
                              <>
                                <button 
                                  onClick={() => executeAction(`/admin/approve-agent/${agent._id}`, 'PUT', { status: 'rejected' })}
                                  className="bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/30 text-rose-700 dark:text-rose-350 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                                >
                                  Reject
                                </button>
                                <button 
                                  onClick={() => executeAction(`/admin/approve-agent/${agent._id}`, 'PUT', { status: 'approved' })}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                                >
                                  Approve
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-slate-50/50 dark:bg-slate-950/10">
                    {agents
                      .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.email.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((agent) => (
                        <div key={agent._id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                          <div 
                            onClick={() => { setModalData(agent); setShowModal('agent-details'); }}
                            className="cursor-pointer space-y-4"
                          >
                            <div className="flex gap-3.5 items-center">
                              <img src={agent.kyc?.selfie || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-850 dark:text-slate-100 hover:text-primary-500 transition-colors truncate">{agent.name}</span>
                                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${agent.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                    {agent.status}
                                  </span>
                                </div>
                                <span className="block text-xs text-slate-400 mt-1 truncate">{agent.email}</span>
                                <span className="block text-xs text-slate-400 truncate">{agent.phone}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 text-center text-xs">
                              <div className="bg-slate-50/80 dark:bg-slate-950/80 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
                                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5 capitalize">{agent.level || 'pincode'}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {agent.level === 'pincode' || !agent.level 
                                    ? (agent.assignedPincode?.code || 'None') 
                                    : (agent.assignedArea || 'None')}
                                </span>
                              </div>
                              <div className="bg-slate-50/80 dark:bg-slate-950/80 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
                                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Wallet</span>
                                <span className="font-bold text-emerald-500">₹{agent.balance || 0}</span>
                              </div>
                              <div className="bg-slate-50/80 dark:bg-slate-950/80 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
                                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Vendors</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{agent.vendorsAdded || 0}</span>
                              </div>
                              <div className="bg-slate-50/80 dark:bg-slate-950/80 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
                                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Comm.</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">₹{agent.commissionEarned || 0}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800/80">
                            <button 
                              onClick={() => { setModalData({ agentId: agent._id }); setShowModal('assign-task'); }}
                              className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                            >
                              Assign Task
                            </button>
                            <button 
                              onClick={() => { setModalData(agent); setShowModal('edit-agent'); }}
                              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                            >
                              Edit
                            </button>
                            {agent.status === 'approved' ? (
                              <button 
                                onClick={() => executeAction(`/admin/approve-agent/${agent._id}`, 'PUT', { status: 'suspended' })}
                                className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                              >
                                Suspend
                              </button>
                            ) : (
                              <>
                                <button 
                                  onClick={() => executeAction(`/admin/approve-agent/${agent._id}`, 'PUT', { status: 'rejected' })}
                                  className="bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/30 text-rose-700 dark:text-rose-350 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                                >
                                  Reject
                                </button>
                                <button 
                                  onClick={() => executeAction(`/admin/approve-agent/${agent._id}`, 'PUT', { status: 'approved' })}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                                >
                                  Approve
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* 5. PINCODE MANAGEMENT */}
          {activeTab === 'pincodes' && (
            <div className="space-y-6">
              
              {/* PINCODE MASTER LOOKUP CARD */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6 max-w-xl mx-auto">
                <h3 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">Pincode Master</h3>
                
                <div className="space-y-4">
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Enter 6-Digit Pincode</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      value={lookupPincode}
                      onChange={(e) => handlePincodeLookup(e.target.value)}
                      placeholder="e.g. 635301" 
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 transition-colors font-mono tracking-widest text-lg"
                    />
                    {lookupLoading && (
                      <span className="absolute right-4 bottom-3 text-xs text-slate-400 animate-pulse">Searching...</span>
                    )}
                  </div>

                  {/* Post Office Selection Dropdown */}
                  {lookupResults.length > 0 && (
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setShowOfficeDropdown(!showOfficeDropdown)}
                        className="w-full bg-white dark:bg-slate-900 border border-primary-500 text-primary-600 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all hover:bg-primary-50/50 flex justify-between items-center"
                      >
                        <span>{selectedOffice ? `Selected: ${selectedOffice.Name}` : `Select Post Office (${lookupResults.length} found)`}</span>
                        <ChevronRight className={`w-4 h-4 transform transition-transform ${showOfficeDropdown ? 'rotate-90' : ''}`} />
                      </button>
                      
                      {showOfficeDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y dark:divide-slate-800">
                          {lookupResults.map((office, idx) => (
                            <button
                              type="button"
                              key={idx}
                              onClick={() => {
                                setSelectedOffice(office);
                                setShowOfficeDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-850 text-sm text-slate-700 dark:text-slate-350 transition-colors"
                            >
                              {office.Name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location Details Box */}
                  {selectedOffice && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="text-center">
                        {pincodes.find(p => p.code === lookupPincode && p.activeAgentId) ? (
                          <span className="inline-flex px-4 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            ⚠️ Already Assigned to Agent: {pincodes.find(p => p.code === lookupPincode).activeAgentId.name}
                          </span>
                        ) : (
                          <span className="inline-flex px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            ✓ Pincode Available
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/40 border dark:border-slate-850 rounded-2xl p-5 space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Location Details</h4>
                        <div className="grid grid-cols-2 gap-y-2 text-xs">
                          <span className="text-slate-400">Post Office:</span>
                          <span className="font-bold text-right text-slate-800 dark:text-slate-200">{selectedOffice.Name}</span>
                          
                          <span className="text-slate-400">District:</span>
                          <span className="font-bold text-right text-slate-800 dark:text-slate-200">{selectedOffice.District}</span>
                          
                          <span className="text-slate-400">State:</span>
                          <span className="font-bold text-right text-slate-800 dark:text-slate-200">{selectedOffice.State}</span>
                          
                          <span className="text-slate-400">Division:</span>
                          <span className="font-bold text-right text-slate-800 dark:text-slate-200">{selectedOffice.Division || 'N/A'}</span>
                          
                          <span className="text-slate-400">Region:</span>
                          <span className="font-bold text-right text-slate-800 dark:text-slate-200">{selectedOffice.Region || 'N/A'}</span>
                          
                          <span className="text-slate-400">Delivery Status:</span>
                          <span className="font-bold text-right text-slate-800 dark:text-slate-200">{selectedOffice.DeliveryStatus}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const saveRes = await executeAction('/admin/save-pincode', 'POST', {
                            pincode: lookupPincode,
                            postOffice: selectedOffice.Name,
                            district: selectedOffice.District,
                            state: selectedOffice.State
                          });
                          if (saveRes.success) {
                            setModalData({ pincodeId: saveRes.data._id });
                            setShowModal('pincode');
                            setLookupPincode('');
                            setLookupResults([]);
                            setSelectedOffice(null);
                          }
                        }}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" /> Add Agent for this Pincode
                      </button>
                    </div>
                  )}
                </div>
              </div>

                         {(() => {
                const uniqueStates = [...new Set(pincodes.map(p => p.state).filter(Boolean))].sort();
                
                // Dynamically filter districts based on selected state
                let availableDistricts = [];
                if (pincodeStateFilter) {
                  const isDelhi = pincodeStateFilter.toLowerCase().includes('delhi');
                  availableDistricts = [...new Set(
                    pincodes
                      .filter(p => {
                        if (isDelhi) {
                          const s = (p.state || '').toLowerCase();
                          const d = (p.district || '').toLowerCase();
                          return (s.includes('delhi') || d.includes('delhi')) && !['bangalore', 'chennai', 'mumbai', 'salem'].includes(d);
                        }
                        return p.state === pincodeStateFilter;
                      })
                      .map(p => p.district)
                      .filter(Boolean)
                  )].sort();
                  // Fallback for Delhi districts if data set is sparse
                  if (isDelhi && availableDistricts.length === 0) {
                    availableDistricts = ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'];
                  }
                } else {
                  availableDistricts = [...new Set(pincodes.map(p => p.district).filter(Boolean))].sort();
                }
                
                const filteredPincodes = pincodes.filter(p => {
                  const matchesSearch = !searchTerm || 
                                        p.code.includes(searchTerm) || 
                                        p.district.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                        p.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        (p.activeAgentId?.name && p.activeAgentId.name.toLowerCase().includes(searchTerm.toLowerCase()));
                                         
                  const matchesState = !pincodeStateFilter || p.state === pincodeStateFilter || (pincodeStateFilter === 'Delhi' && (p.state?.toLowerCase().includes('delhi') || p.district?.toLowerCase().includes('delhi')));
                  const matchesDistrict = !pincodeDistrictFilter || p.district === pincodeDistrictFilter;
                  const matchesStatus = pincodeStatusFilter === 'all' || 
                                        (pincodeStatusFilter === 'assigned' && p.activeAgentId) || 
                                        (pincodeStatusFilter === 'unassigned' && !p.activeAgentId);
                                         
                  return matchesSearch && matchesState && matchesDistrict && matchesStatus;
                });

                return (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                      <div className="flex flex-1 flex-wrap gap-3 w-full">
                        <div className="flex gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl flex-1 min-w-[200px]">
                          <Search className="w-5 h-5 text-slate-400" />
                          <input 
                            type="text" 
                            placeholder="Search pincode, district, state, agent..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent focus:outline-none text-sm w-full"
                          />
                        </div>
                        
                        <select
                          value={pincodeStateFilter}
                          onChange={(e) => {
                            setPincodeStateFilter(e.target.value);
                            setPincodeDistrictFilter('');
                          }}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <option value="">All States</option>
                          {uniqueStates.map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>

                        <select
                          value={pincodeDistrictFilter}
                          onChange={(e) => setPincodeDistrictFilter(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <option value="">All Districts</option>
                          {availableDistricts.map(district => (
                            <option key={district} value={district}>{district}</option>
                          ))}
                        </select>

                        <select
                          value={pincodeStatusFilter}
                          onChange={(e) => setPincodeStatusFilter(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <option value="all">All Assignments</option>
                          <option value="assigned">Assigned</option>
                          <option value="unassigned">Unassigned</option>
                        </select>
                      </div>

                      <div className="flex gap-2 shrink-0 w-full xl:w-auto justify-end">
                        <button 
                          onClick={() => { setModalData(null); setShowModal('pincode'); }}
                          className="bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs"
                        >
                          Assign Pincode
                        </button>
                        <button 
                          onClick={() => { setModalData(null); setShowModal('create-pincode'); }}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs"
                        >
                          Create Pincode
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredPincodes.map((pin) => (
                        <div key={pin._id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/50 dark:border-slate-850 flex items-center justify-between">
                          <div>
                            <span className="block text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{pin.code}</span>
                            <span className="text-xs text-slate-400">{pin.name}, {pin.district}, {pin.state}</span>
                            <span className="block text-xs font-semibold mt-2">
                              Assigned Agent: {pin.activeAgentId ? (
                                <span className="text-primary-500 font-bold">{pin.activeAgentId.name}</span>
                              ) : (
                                <span className="text-slate-400 italic">Available</span>
                              )}
                            </span>
                          </div>
                          {pin.activeAgentId && (
                            <button 
                              onClick={() => executeAction('/admin/pincodes/remove', 'POST', { pincodeId: pin._id })}
                              className="text-xs font-bold text-rose-500 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-all"
                            >
                              Deassign
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 6. VENDOR MANAGEMENT & TIE-UPS */}
          {activeTab === 'vendors' && (
            <div className="space-y-6">
              
              {/* Category Filter */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {['All', ...new Set(categories.map(c => c.name))].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${filterCategory === cat ? 'bg-primary-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Vendors List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {vendors
                  .filter(v => filterCategory === 'All' || v.category === filterCategory || (v.vendorType && v.vendorType.toLowerCase().includes(filterCategory.toLowerCase())) || (v.subcategory && v.subcategory.toLowerCase().includes(filterCategory.toLowerCase())))
                  .map((vendor) => (
                    <div key={vendor._id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition-shadow">
                      <div 
                        onClick={() => { setModalData(vendor); setShowModal('vendor-details'); }}
                        className="cursor-pointer space-y-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-850 dark:text-slate-100 hover:text-primary-500 transition-colors">{vendor.businessName}</span>
                              <span className="bg-primary-500/10 text-primary-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{vendor.category}</span>
                              {vendor.subcategory && (
                                <span className="bg-purple-500/10 text-purple-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{vendor.subcategory}</span>
                              )}
                              {vendor.baseVendorType && (
                                <span className="bg-blue-500/10 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{vendor.baseVendorType}</span>
                              )}
                            </div>
                            <span className="block text-xs text-slate-400 mt-1">{vendor.contactName} • {vendor.phone}</span>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${vendor.status?.toLowerCase() === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : vendor.status?.toLowerCase() === 'rejected' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            {vendor.status}
                          </span>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl text-xs space-y-2 border border-slate-200/50 dark:border-slate-850">
                          {vendor.vendorType && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Vendor Type:</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{vendor.vendorType}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-400">Referred Agent:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{vendor.agentId?.name || 'Direct / Platform Add'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Membership Tier:</span>
                            <span className="font-bold text-amber-500 uppercase">{vendor.membership?.status === 'active' ? 'Active Pro' : 'None'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        {vendor.status?.toLowerCase() !== 'rejected' && (
                          <button 
                            onClick={() => executeAction(`/admin/vendors/${vendor._id}/reject`, 'PUT', {})}
                            className="bg-slate-100 hover:bg-rose-500/10 dark:bg-slate-800 hover:text-rose-500 text-slate-600 dark:text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                          >
                            Reject
                          </button>
                        )}
                        {vendor.status?.toLowerCase() !== 'approved' && (
                          <button 
                            onClick={() => executeAction(`/admin/vendors/${vendor._id}/approve`, 'PUT', {})}
                            className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                          >
                            Approve Vendor
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete ${vendor.businessName}?`)) {
                              executeAction(`/admin/vendors/${vendor._id}`, 'DELETE');
                            }
                          }}
                          className="bg-rose-600 hover:bg-rose-550 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </div>
                ))}
              </div>

            </div>
          )}

          {/* 7. CUSTOMERS VIEW */}
          {activeTab === 'customers' && (() => {
            const customerDistricts = [...new Set(customers.map(c => c.district || c.branchId?.name || c.city).filter(Boolean))].sort();
            const customerTypes = [...new Set(customers.map(c => c.customerType || c.type || 'Standard').filter(Boolean))].sort();

            const filteredCustomers = customers.filter(c => {
              const matchesSearch = !customerSearchTerm ||
                (c.name || '').toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                (c.email || '').toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                (c.phone || '').includes(customerSearchTerm);

              const dist = c.district || c.branchId?.name || c.city || 'Direct';
              const matchesDistrict = customerDistrictFilter === 'All' || dist === customerDistrictFilter;

              const statusVal = c.status?.toLowerCase() === 'active' ? 'Active' : 'Inactive';
              const matchesStatus = customerStatusFilter === 'All' || statusVal === customerStatusFilter;

              const typeVal = c.customerType || c.type || 'Standard';
              const matchesType = customerTypeFilter === 'All' || typeVal === customerTypeFilter;

              return matchesSearch && matchesDistrict && matchesStatus && matchesType;
            });

            return (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-1 flex-wrap gap-3 w-full">
                      {/* Search Bar */}
                      <div className="flex gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl flex-1 min-w-[240px]">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search by customer name, email, or phone..." 
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                          className="bg-transparent focus:outline-none text-sm w-full"
                        />
                      </div>

                      {/* District Filter */}
                      <select
                        value={customerDistrictFilter}
                        onChange={(e) => setCustomerDistrictFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Districts</option>
                        {customerDistricts.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>

                      {/* Status Filter */}
                      <select
                        value={customerStatusFilter}
                        onChange={(e) => setCustomerStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>

                      {/* Customer Type Filter */}
                      <select
                        value={customerTypeFilter}
                        onChange={(e) => setCustomerTypeFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Customer Types</option>
                        {customerTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-4">Customer Name</th>
                          <th className="px-6 py-4">Contact Info</th>
                          <th className="px-6 py-4">Customer Type</th>
                          <th className="px-6 py-4">Aadhaar Number</th>
                          <th className="px-6 py-4">PAN Number</th>
                          <th className="px-6 py-4">District</th>
                          <th className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredCustomers.map((c) => (
                          <tr key={c._id}>
                            <td className="px-6 py-4 font-semibold text-slate-850 dark:text-slate-200">{c.name}</td>
                            <td className="px-6 py-4 text-xs">
                              <span className="block">{c.email}</span>
                              <span className="block text-slate-400 mt-0.5">{c.phone}</span>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-purple-500">
                              {c.customerType || c.type || 'Standard'}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-slate-400">{c.aadhaarNumber || '—'}</td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-slate-400">{c.panNumber || '—'}</td>
                            <td className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">{c.district || c.branchId?.name || c.city || 'Direct'}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${c.status === 'active' || c.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {c.status === 'active' || c.status === 'Active' ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredCustomers.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-slate-400 text-sm">
                              No customers found matching search and filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 8. KYC VERIFICATION SCREEN */}
          {activeTab === 'kyc' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">KYC Verification Inbox</h3>
                  <div className="flex gap-2">
                    {['pending', 'approved', 'rejected'].map(st => {
                      const isSelected = (filterCategory === st) || (st === 'pending' && !['approved', 'rejected'].includes(filterCategory));
                      return (
                        <button
                          key={st}
                          onClick={() => setFilterCategory(st)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${isSelected ? 'bg-primary-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'}`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {agents
                    .filter(a => {
                      const currentFilter = ['pending', 'approved', 'rejected'].includes(filterCategory) ? filterCategory : 'pending';
                      return a.status === currentFilter;
                    })
                    .map((agent) => (
                    <div key={agent._id} className="py-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-extrabold text-slate-850 dark:text-slate-100 text-lg">{agent.name}</span>
                          <span className="block text-xs text-slate-400">{agent.email} • {agent.phone}</span>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          agent.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 
                          agent.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' : 
                          'bg-amber-500/10 text-amber-500'
                        }`}>
                          KYC {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                        </span>
                      </div>

                      {/* Documents viewer */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div 
                          onClick={() => setKycPreviewImage(agent.kyc?.aadhaarImage || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500')}
                          className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/50 dark:border-slate-850 text-center cursor-pointer hover:shadow-md hover:border-slate-350 dark:hover:border-slate-700 transition-all"
                        >
                          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Aadhaar Card</span>
                          <img src={agent.kyc?.aadhaarImage || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'} alt="Aadhaar" className="w-full h-24 object-cover rounded-lg border" />
                          <span className="block text-[10px] font-mono mt-2">{agent.kyc?.aadhaarNumber || '987654321098'}</span>
                        </div>
                        <div 
                          onClick={() => setKycPreviewImage(agent.kyc?.panImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500')}
                          className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/50 dark:border-slate-850 text-center cursor-pointer hover:shadow-md hover:border-slate-350 dark:hover:border-slate-700 transition-all"
                        >
                          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">PAN Card</span>
                          <img src={agent.kyc?.panImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'} alt="PAN" className="w-full h-24 object-cover rounded-lg border" />
                          <span className="block text-[10px] font-mono mt-2">{agent.kyc?.panNumber || 'ABCDE1234F'}</span>
                        </div>
                        <div 
                          onClick={() => setKycPreviewImage(agent.kyc?.selfie || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500')}
                          className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/50 dark:border-slate-850 text-center cursor-pointer hover:shadow-md hover:border-slate-350 dark:hover:border-slate-700 transition-all"
                        >
                          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Selfie Video/Photo</span>
                          <img src={agent.kyc?.selfie || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} alt="Selfie" className="w-full h-24 object-cover rounded-lg border" />
                        </div>
                        <div 
                          onClick={() => setKycPreviewImage(agent.kyc?.businessProofImage || 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=500')}
                          className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/50 dark:border-slate-850 text-center cursor-pointer hover:shadow-md hover:border-slate-350 dark:hover:border-slate-700 transition-all"
                        >
                          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Business Proof</span>
                          <img src={agent.kyc?.businessProofImage || 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=150'} alt="Proof" className="w-full h-24 object-cover rounded-lg border" />
                        </div>
                      </div>

                      {agent.status === 'pending' && (
                        <div className="flex gap-3 justify-end">
                          <button 
                            onClick={() => executeAction(`/admin/approve-agent/${agent._id}`, 'PUT', { status: 'rejected' })}
                            className="bg-slate-100 hover:bg-rose-500/10 text-rose-500 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
                          >
                            Reject / Request Reupload
                          </button>
                          <button 
                            onClick={() => executeAction(`/admin/approve-agent/${agent._id}`, 'PUT', { status: 'approved' })}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
                          >
                            Verify & Approve KYC
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {agents.filter(a => a.status === (['pending', 'approved', 'rejected'].includes(filterCategory) ? filterCategory : 'pending')).length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      No agents found for this status.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BUSINESS TIE-UPS SCREEN */}
          {activeTab === 'tieups' && (() => {
            const filteredTieups = tieups.filter(t => {
              const matchesSearch = !tieupSearchTerm ||
                (t.businessName || '').toLowerCase().includes(tieupSearchTerm.toLowerCase()) ||
                (t.customerName || '').toLowerCase().includes(tieupSearchTerm.toLowerCase()) ||
                (t.vendorName || '').toLowerCase().includes(tieupSearchTerm.toLowerCase()) ||
                (t.agentId?.name || '').toLowerCase().includes(tieupSearchTerm.toLowerCase());

              const entityType = t.entityType || t.type || (t.category === 'Services' || t.category === 'Product' ? 'Vendor' : 'Customer');
              const matchesEntity = tieupEntityFilter === 'All' || entityType.toLowerCase() === tieupEntityFilter.toLowerCase();

              const matchesStatus = filterCategory === 'All' || filterCategory === 'pending' || filterCategory === 'approved' || filterCategory === 'rejected' ? (filterCategory === 'All' || t.status === filterCategory) : true;

              return matchesSearch && matchesEntity && matchesStatus;
            });

            return (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Business Tie-Up Requests</h3>
                    
                    <div className="flex flex-wrap gap-3 w-full xl:w-auto items-center">
                      {/* Search Bar */}
                      <div className="flex gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-xl flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 text-slate-400 my-auto" />
                        <input 
                          type="text" 
                          placeholder="Search by customer or vendor..." 
                          value={tieupSearchTerm}
                          onChange={(e) => setTieUpSearchTerm(e.target.value)}
                          className="bg-transparent focus:outline-none text-xs w-full"
                        />
                      </div>

                      {/* Entity Filter Dropdown */}
                      <select
                        value={tieupEntityFilter}
                        onChange={(e) => setTieUpEntityFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Parties (Customer & Vendor)</option>
                        <option value="Customer">Customer</option>
                        <option value="Vendor">Vendor</option>
                      </select>

                      {/* Existing Status Filter Buttons */}
                      <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                        {['All', 'pending', 'approved', 'rejected'].map(st => (
                          <button
                            key={st}
                            onClick={() => setFilterCategory(st)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${filterCategory === st ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-850'}`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredTieups.map((tieup) => (
                      <div key={tieup._id} className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-850 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="block font-bold text-slate-800 dark:text-slate-200 text-base">{tieup.businessName}</span>
                            <span className="text-xs text-slate-400">Category: {tieup.category} • Subcategory: {tieup.serviceType}</span>
                          </div>
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold capitalize ${tieup.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : tieup.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            {tieup.status}
                          </span>
                        </div>

                        <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
                          <p><strong>Location:</strong> {tieup.location} (Pincode: {tieup.pincode})</p>
                          {tieup.businessLicense && <p><strong>License:</strong> {tieup.businessLicense}</p>}
                          <p><strong>Submitted By:</strong> {tieup.agentId?.name || 'Unknown Agent'} ({tieup.agentId?.phone || ''})</p>
                          {tieup.submittedAt && <p><strong>Date:</strong> {new Date(tieup.submittedAt).toLocaleDateString()}</p>}
                        </div>

                        {tieup.proofImage && (
                          <div>
                            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Proof Image</span>
                            <img src={tieup.proofImage} alt="Proof" className="w-full h-32 object-cover rounded-xl border dark:border-slate-800 cursor-pointer hover:opacity-95" onClick={() => window.open(tieup.proofImage, '_blank')} />
                          </div>
                        )}

                        <div className="flex gap-2 justify-end pt-2">
                          <button
                            onClick={() => { setModalData(tieup); setShowModal('edit-tieup'); }}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all"
                          >
                            Edit Request
                          </button>
                          {tieup.status === 'pending' && (
                            <>
                              <button
                                onClick={() => executeAction(`/admin/tie-up/${tieup._id}`, 'PUT', { status: 'rejected' })}
                                className="bg-rose-50/50 hover:bg-rose-500/10 text-rose-500 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => executeAction(`/admin/tie-up/${tieup._id}`, 'PUT', { status: 'approved' })}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                              >
                                Approve
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  {tieups.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-slate-400 text-sm">
                      <Layers className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      No business tie-up requests found.
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

          {/* AGENT TASKS SCREEN */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Task Assignments</h3>
                  <button
                    onClick={() => { setModalData(null); setShowModal('assign-task'); }}
                    className="bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Assign New Task
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="px-6 py-4">Task Details</th>
                        <th className="px-6 py-4">Assigned Agent</th>
                        <th className="px-6 py-4">Due Date</th>
                        <th className="px-6 py-4">Assigned By</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {tasks.map((task) => (
                        <tr key={task._id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                          <td className="px-6 py-4">
                            <span className="block font-bold text-slate-800 dark:text-slate-100">{task.title}</span>
                            <span className="text-xs text-slate-400">{task.description}</span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                            {task.assignedTo?.name || 'Unknown Agent'}
                            <span className="block text-[10px] text-slate-400 font-normal">{task.assignedTo?.email}</span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-500">
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Due Date'}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {task.adminId?.name || 'Admin'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold capitalize ${task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : task.status === 'in-progress' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'}`}>
                              {task.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {tasks.length === 0 && (
                        <tr>
                          <td colSpan="5" className="text-center py-12 text-slate-400 text-sm">
                            <CheckCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                            No tasks have been assigned yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 9. WALLET & WITHDRAWALS */}
          {activeTab === 'wallet' && (() => {
            const filteredWithdrawals = withdrawals.filter(req => {
              const nameVal = req.agentId?.name || req.accountHolderName || 'Amit Sharma';
              const emailVal = req.agentId?.email || '';
              const phoneVal = req.agentId?.phone || '';
              const bankVal = req.bankName || '';
              const accVal = req.accountNumber || '';
              const ifscVal = req.ifscCode || '';
              const branchVal = req.branchName || '';

              const matchesSearch = !withdrawalSearchTerm ||
                nameVal.toLowerCase().includes(withdrawalSearchTerm.toLowerCase()) ||
                emailVal.toLowerCase().includes(withdrawalSearchTerm.toLowerCase()) ||
                phoneVal.includes(withdrawalSearchTerm) ||
                bankVal.toLowerCase().includes(withdrawalSearchTerm.toLowerCase()) ||
                accVal.includes(withdrawalSearchTerm) ||
                ifscVal.toLowerCase().includes(withdrawalSearchTerm.toLowerCase()) ||
                branchVal.toLowerCase().includes(withdrawalSearchTerm.toLowerCase());

              const matchesStatus = withdrawalStatusFilter === 'All' || (req.status || '').toLowerCase() === withdrawalStatusFilter.toLowerCase();

              return matchesSearch && matchesStatus;
            });

            return (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                  
                  {/* Top Bar with Title, Search Bar & Status Filters */}
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Withdrawal Request Queues</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Manage agent payout requests and view complete applicant details</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 w-full xl:w-auto items-center">
                      {/* Search Bar */}
                      <div className="flex gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl flex-1 min-w-[260px]">
                        <Search className="w-4 h-4 text-slate-400 my-auto" />
                        <input 
                          type="text" 
                          placeholder="Search by name, phone, email, or bank details..." 
                          value={withdrawalSearchTerm}
                          onChange={(e) => setWithdrawalSearchTerm(e.target.value)}
                          className="bg-transparent focus:outline-none text-xs w-full"
                        />
                      </div>

                      {/* Status Filter Buttons */}
                      <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                        {['All', 'Pending', 'Approved', 'Rejected', 'Completed'].map(st => (
                          <button
                            key={st}
                            onClick={() => setWithdrawalStatusFilter(st)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${withdrawalStatusFilter === st ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-850'}`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Withdrawal List Cards */}
                  <div className="space-y-4">
                    {filteredWithdrawals.map((req) => (
                      <div 
                        key={req._id} 
                        onClick={() => {
                          setModalData(req);
                          setShowModal('bank-details');
                        }}
                        className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:shadow-md hover:border-primary-500/40 transition-all group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="block font-extrabold text-slate-850 dark:text-slate-100 group-hover:text-primary-500 transition-colors text-base">
                              {req.agentId?.name || req.accountHolderName || 'Amit Sharma'}
                            </span>
                            <span className="text-[10px] text-primary-500 font-bold bg-primary-500/10 px-2.5 py-0.5 rounded-full border border-primary-500/20">
                              Click for Full Person & Bank Details
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            <strong>Contact:</strong> {req.agentId?.email || 'amit@example.com'} • {req.agentId?.phone || '9876543210'}
                          </p>
                          <p className="text-xs text-slate-400">
                            <strong>Wallet Balance:</strong> <span className="text-emerald-500 font-bold">₹{req.agentId?.balance || 7500}</span> • <strong>Req Date:</strong> {new Date(req.createdAt).toLocaleString()}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                          <div className="text-right">
                            <span className="text-2xl font-black text-rose-500 block">₹{req.amount}</span>
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider inline-block mt-0.5 ${req.status?.toLowerCase() === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : req.status?.toLowerCase() === 'completed' ? 'bg-blue-500/10 text-blue-500' : req.status?.toLowerCase() === 'rejected' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                              {req.status}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalData(req);
                              setShowModal('bank-details');
                            }}
                            className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md"
                          >
                            View Full Details
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredWithdrawals.length === 0 && (
                      <div className="text-center py-12 text-slate-400 text-sm">
                        <CheckCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        No withdrawal requests found matching search and filters.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 10. COMMISSIONS CONFIG */}
          {activeTab === 'commissions' && isSuperAdmin && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Global & District Commission Rates</h3>
                
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const value = e.target.value.value;
                    const type = e.target.type.value;
                    const scope = e.target.scope.value;
                    executeAction('/admin/commissions', 'POST', { scope, type, value: Number(value) });
                  }}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Scope</label>
                    <select name="scope" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2.5 text-sm">
                      <option value="global">Global Commission</option>
                      <option value="branch">District Commission</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Type</label>
                    <select name="type" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2.5 text-sm">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Rate / Value</label>
                    <input name="value" type="number" required placeholder="e.g. 5" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2.5 text-sm" />
                  </div>
                  <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 rounded-xl transition-all">
                    Update Configuration
                  </button>
                </form>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Commissions Setup</h4>
                  {commissions.map((comm, idx) => (
                    <div key={idx} className="flex justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-sm border">
                      <span className="capitalize font-bold text-slate-700 dark:text-slate-300">{comm.scope} Rate</span>
                      <span className="font-black text-primary-500">{comm.value} {comm.type === 'percentage' ? '%' : '₹'}</span>
                    </div>
                  ))}
                  {commissions.length === 0 && (
                    <div className="flex justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-sm border">
                      <span className="capitalize font-bold text-slate-700 dark:text-slate-300">Global Rate (Default)</span>
                      <span className="font-black text-primary-500">5 %</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 11. MEMBERSHIPS */}
          {activeTab === 'memberships' && isSuperAdmin && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Vendor Membership Plans</h3>
                <button 
                  onClick={() => { setModalData(null); setShowModal('plan'); }}
                  className="bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md"
                >
                  <Plus className="w-4 h-4" /> Create Plan
                </button>
              </div>

              {membershipPlans.length > 0 ? (() => {
                const activePlan = membershipPlans[selectedPlanTab] || membershipPlans[0];
                const isGold = activePlan.name.toLowerCase().includes('gold');
                const isPlatinum = activePlan.name.toLowerCase().includes('platinum') || activePlan.name.toLowerCase().includes('enterprise');
                const isSilver = !isGold && !isPlatinum;

                // Card gradient definitions
                let cardGradient = 'from-slate-300 via-slate-100 to-slate-400 text-slate-800';
                let tierText = 'SILVER TIER';
                if (isGold) {
                  cardGradient = 'from-amber-300 via-yellow-100 to-amber-500 text-amber-950 shadow-amber-500/10';
                  tierText = 'GOLD TIER';
                } else if (isPlatinum) {
                  cardGradient = 'from-slate-850 via-slate-900 to-slate-950 text-slate-100 border border-slate-700/60 shadow-slate-950/40';
                  tierText = 'PLATINUM TIER';
                }

                return (
                  <div className="space-y-6">
                    {/* Plan Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200/60 dark:border-slate-850">
                      {membershipPlans.map((plan, idx) => (
                        <button
                          key={plan._id}
                          onClick={() => setSelectedPlanTab(idx)}
                          className={`px-5 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all ${selectedPlanTab === idx ? 'bg-primary-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'}`}
                        >
                          {plan.name}
                        </button>
                      ))}
                    </div>

                    {/* Two Side Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center pt-2">
                      {/* Left Side: Membership Benefits Card */}
                      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-xl relative min-h-[380px] flex flex-col justify-between text-white">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <span className="text-xs uppercase font-extrabold tracking-widest text-primary-400">{tierText}</span>
                            <button 
                              onClick={() => executeAction(`/admin/memberships/plans/${activePlan._id}`, 'DELETE')}
                              className="text-slate-500 hover:text-rose-500 p-1.5 rounded-lg transition-colors"
                              title="Delete Plan"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                          
                          <h4 className="text-2xl font-black">{activePlan.name}</h4>
                          
                          <div className="flex items-baseline gap-1.5 pt-2 border-b border-slate-800 pb-4">
                            <span className="text-4xl font-black">₹{activePlan.price}</span>
                            <span className="text-sm text-slate-400">/ {activePlan.duration} days</span>
                          </div>

                          <div className="space-y-3 pt-2">
                            <span className="block text-xs uppercase font-extrabold tracking-wider text-slate-400">Membership Benefits</span>
                            <ul className="space-y-2.5 text-xs text-slate-350">
                              {activePlan.features.map((f, idx) => (
                                <li key={idx} className="flex items-center gap-2.5">
                                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="pt-6 border-t border-slate-800/80">
                          <button
                            onClick={() => { setModalData(activePlan); setShowModal('plan'); }}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 rounded-xl transition-all border border-slate-750"
                          >
                            Edit Plan Details
                          </button>
                        </div>
                      </div>

                      {/* Right Side: Virtual Premium Card */}
                      <div className="flex flex-col items-center justify-center space-y-6">
                        <div className={`w-full max-w-[420px] aspect-[1.58/1] rounded-3xl bg-gradient-to-br ${cardGradient} p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-transform duration-300 hover:scale-[1.02]`}>
                          {/* Glossy Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none"></div>
                          
                          {/* Top Card Info */}
                          <div className="flex justify-between items-start relative z-10">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black tracking-widest uppercase opacity-60">MEMBERSHIP</span>
                              <span className="text-lg font-black tracking-tighter">CONNECT</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <div className="w-10 h-7 bg-white/10 rounded-md border border-white/10 flex items-center justify-center text-[8px] font-mono tracking-widest opacity-80">CHIP</div>
                              <span className="text-[9px] font-extrabold tracking-widest mt-1 opacity-70">{tierText}</span>
                            </div>
                          </div>

                          {/* Center Card Info */}
                          <div className="flex items-center gap-4 relative z-10 my-4">
                            <div className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
                              <Award className="w-4.5 h-4.5 opacity-90" />
                            </div>
                            <span className="font-mono text-base tracking-widest opacity-95">••••  ••••  ••••  {activePlan.price}</span>
                          </div>

                          {/* Bottom Card Info */}
                          <div className="flex justify-between items-end relative z-10">
                            <div className="flex flex-col">
                              <span className="text-[8px] uppercase tracking-wider opacity-50">Card Holder</span>
                              <span className="text-xs font-bold tracking-wide uppercase">FORGE INDIA CONNECT</span>
                            </div>
                            <span className="text-[9px] font-bold opacity-60">VAL : {activePlan.duration} DAYS</span>
                          </div>
                        </div>

                        <button
                          onClick={() => { setModalData(activePlan); setShowModal('plan'); }}
                          className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition-all"
                        >
                          Edit Card Design
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400">
                  No membership plans found. Click Create Plan to add one.
                </div>
              )}
            </div>
          )}

          {/* 12. BANNER & ADS */}
          {activeTab === 'banners' && isSuperAdmin && (
            <div className="space-y-6">
              
              {/* Banners CRUD */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Promotional Banners</h3>
                  <button 
                    onClick={() => setShowModal('banner')}
                    className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-lg"
                  >
                    Add Banner
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {banners.map((b) => (
                    <div key={b._id} className="border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 flex">
                      <img src={b.imageUrl} alt="" className="w-32 h-24 object-cover shrink-0" />
                      <div className="p-3.5 flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <span className="block font-bold text-sm truncate">{b.title}</span>
                          <span className="block text-[10px] text-slate-400 mt-1">Expiry: {new Date(b.endDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-500 text-[10px] font-bold">Active</span>
                          <button 
                            onClick={() => executeAction(`/admin/banners/${b._id}`, 'DELETE')}
                            className="text-rose-500 text-[10px] font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advertisement Tracking */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Paid Advertisements Campaigns</h3>
                  <button 
                    onClick={() => setShowModal('ad')}
                    className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-lg"
                  >
                    Launch Ad Campaign
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {ads.map((ad) => (
                    <div key={ad._id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/50 dark:border-slate-850 space-y-3">
                      <div className="flex justify-between">
                        <span className="font-bold text-sm">{ad.title}</span>
                        <span className="text-emerald-500 text-xs font-bold">Earnings: ₹{ad.revenue}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg">
                          <span className="block text-slate-400 text-[10px]">Impressions</span>
                          <span className="font-bold">{ad.impressions}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg">
                          <span className="block text-slate-400 text-[10px]">Clicks</span>
                          <span className="font-bold">{ad.clicks}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg">
                          <span className="block text-slate-400 text-[10px]">CTR</span>
                          <span className="font-bold text-primary-500">{ad.ctr}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* 13. BUSINESS REPORTS & EXPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setReportType('revenue')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${reportType === 'revenue' ? 'bg-primary-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                    >
                      District Revenue Reports
                    </button>
                    <button 
                      onClick={() => setReportType('vendors')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${reportType === 'vendors' ? 'bg-primary-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                    >
                      Vendor Performance Reports
                    </button>
                    <button 
                      onClick={() => setReportType('agents')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${reportType === 'agents' ? 'bg-primary-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                    >
                      Agent Performance Reports
                    </button>
                  </div>

                  <div className="flex gap-2 text-xs">
                    <button onClick={() => handleExport('pdf')} className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-2 rounded-xl font-semibold transition-all">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button onClick={() => handleExport('xlsx')} className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-2 rounded-xl font-semibold transition-all">
                      <Download className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button onClick={() => handleExport('csv')} className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-2 rounded-xl font-semibold transition-all">
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                  </div>
                </div>

                {/* Report Table Display */}
                <div className="overflow-x-auto">
                  {reportType === 'revenue' ? (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-4">District Details</th>
                          <th className="px-6 py-4">District Code</th>
                          <th className="px-6 py-4">Total Orders</th>
                          <th className="px-6 py-4">Revenue</th>
                          <th className="px-6 py-4">Earned Commission</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {reports.map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{row.branchName}</td>
                            <td className="px-6 py-4 font-mono">{row.branchCode}</td>
                            <td className="px-6 py-4 font-semibold">{row.totalOrders}</td>
                            <td className="px-6 py-4 font-bold text-emerald-500">₹{row.revenue?.toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-primary-500">₹{row.commission?.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : reportType === 'vendors' ? (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-4">Vendor Business</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4">Total Orders</th>
                          <th className="px-6 py-4">Revenue Generated</th>
                          <th className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {reports.map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{row.businessName}</td>
                            <td className="px-6 py-4 font-semibold text-primary-500">{row.category}</td>
                            <td className="px-6 py-4">{row.orders}</td>
                            <td className="px-6 py-4 font-bold text-emerald-500">₹{row.revenue?.toLocaleString()}</td>
                            <td className="px-6 py-4 capitalize">{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-4">Agent Name</th>
                          <th className="px-6 py-4">Level & Pincode</th>
                          <th className="px-6 py-4">Vendors Added</th>
                          <th className="px-6 py-4">Commission Earned</th>
                          <th className="px-6 py-4">Wallet Balance</th>
                          <th className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {reports.map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-4">
                              <span className="block font-bold text-slate-800 dark:text-slate-200">{row.agentName}</span>
                              <span className="text-[10px] text-slate-400">{row.email}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="block capitalize font-semibold text-primary-500">{row.level}</span>
                              <span className="text-[10px] text-slate-400">Pincode: {row.pincode}</span>
                            </td>
                            <td className="px-6 py-4 font-semibold">{row.vendorsAdded}</td>
                            <td className="px-6 py-4 font-bold text-emerald-500">₹{row.commissionEarned?.toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">₹{row.balance?.toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold capitalize ${row.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* 14. SYSTEM SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* General Config */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">General Platform Settings</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Platform Name</label>
                        <input type="text" defaultValue="MAM Connect App" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Support Helpline</label>
                        <input type="text" defaultValue="+91 99887 76655" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Payment Gateway mock */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Razorpay Configurations</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Key ID</label>
                        <input type="text" defaultValue="rzp_test_placeholder" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Key Secret</label>
                        <input type="password" placeholder="••••••••••••••••" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm" />
                      </div>
                    </div>
                  </div>

                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button onClick={() => addToast('Settings Saved Successfully!', 'success')} className="bg-primary-600 hover:bg-primary-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all">
                    Save Changes
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* 15. TOTAL ORDERS */}
          {activeTab === 'orders' && (() => {
            const productOptions = [...new Set(orders.map(o => o.productDetails || o.product_details || o.productName || 'General Product').filter(Boolean))].sort();

            const filteredOrders = orders.filter(o => {
              const matchesSearch = !ordersSearchTerm ||
                (o.order_number || o.id || '').toLowerCase().includes(ordersSearchTerm.toLowerCase()) ||
                (o.productDetails || o.product_details || o.productName || '').toLowerCase().includes(ordersSearchTerm.toLowerCase()) ||
                (o.vendorId?.businessName || o.vendorName || '').toLowerCase().includes(ordersSearchTerm.toLowerCase()) ||
                (o.customerId?.name || '').toLowerCase().includes(ordersSearchTerm.toLowerCase());

              const matchesStatus = ordersStatusFilter === 'All' || (o.status || '').toLowerCase() === ordersStatusFilter.toLowerCase();

              const prodName = o.productDetails || o.product_details || o.productName || 'General Product';
              const matchesProduct = ordersProductFilter === 'All' || prodName === ordersProductFilter;

              let matchesDate = true;
              if (ordersDateFilter !== 'All' && o.createdAt) {
                const oDate = new Date(o.createdAt);
                const now = new Date();
                if (ordersDateFilter === 'Today') {
                  matchesDate = oDate.toDateString() === now.toDateString();
                } else if (ordersDateFilter === 'Weekly') {
                  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  matchesDate = oDate >= sevenDaysAgo;
                } else if (ordersDateFilter === 'Monthly') {
                  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  matchesDate = oDate >= thirtyDaysAgo;
                }
              }

              return matchesSearch && matchesStatus && matchesProduct && matchesDate;
            });

            return (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Total Orders Management</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                    <span className="block text-slate-400 text-xs font-bold uppercase">Total Orders</span>
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2 block">{filteredOrders.length}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                    <span className="block text-slate-400 text-xs font-bold uppercase">Total Volume</span>
                    <span className="text-3xl font-extrabold text-emerald-500 mt-2 block">₹{filteredOrders.reduce((sum, o) => sum + (o.amount || 0), 0).toLocaleString()}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                    <span className="block text-slate-400 text-xs font-bold uppercase">Total Commission</span>
                    <span className="text-3xl font-extrabold text-primary-500 mt-2 block">₹{filteredOrders.reduce((sum, o) => sum + (o.commission || 0), 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Toolbar / Search & Filter Controls */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-1 flex-wrap gap-3 w-full">
                      {/* Search Bar */}
                      <div className="flex gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl flex-1 min-w-[240px]">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search by Order #, Product, Vendor, or Customer..." 
                          value={ordersSearchTerm}
                          onChange={(e) => setOrdersSearchTerm(e.target.value)}
                          className="bg-transparent focus:outline-none text-sm w-full"
                        />
                      </div>

                      {/* Product Filter */}
                      <select
                        value={ordersProductFilter}
                        onChange={(e) => setOrdersProductFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Products</option>
                        {productOptions.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>

                      {/* Date Filter */}
                      <select
                        value={ordersDateFilter}
                        onChange={(e) => setOrdersDateFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Time</option>
                        <option value="Today">Today</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>

                      {/* Status Filter */}
                      <select
                        value={ordersStatusFilter}
                        onChange={(e) => setOrdersStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-4">Order Number</th>
                          <th className="px-6 py-4">Vendor</th>
                          <th className="px-6 py-4">Customer</th>
                          <th className="px-6 py-4">Product Details</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Commission</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredOrders.map((order) => {
                          const vName = order.vendorId?.businessName || order.vendorName || order.vendorId?.name || 'Apollo City Hospital';
                          const pDetails = order.productDetails || order.product_details || order.productName || 'General Product';
                          return (
                            <tr key={order._id}>
                              <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{order.order_number || order.id || 'N/A'}</td>
                              <td className="px-6 py-4">
                                <span className="block font-semibold text-slate-850 dark:text-slate-100">{vName}</span>
                                <span className="text-xs text-slate-400">{order.vendorId?.email || 'vendor@example.com'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="block font-semibold">{order.customerId?.name || 'Uma Devi'}</span>
                                <span className="text-xs text-slate-400">{order.customerId?.phone || '1234567890'}</span>
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs px-2.5 py-1 rounded-md font-semibold inline-block">
                                  {pDetails}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-bold text-emerald-500">₹{order.amount}</td>
                              <td className="px-6 py-4 font-bold text-primary-500">₹{order.commission}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold capitalize ${order.status?.toLowerCase() === 'delivered' || order.status?.toLowerCase() === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : order.status?.toLowerCase() === 'cancelled' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                        {filteredOrders.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-slate-400 text-sm">
                              No orders found matching search and filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 16. BOOKINGS */}
          {activeTab === 'bookings' && (() => {
            const filteredBookings = bookings.filter(b => {
              const vName = b.vendorId?.businessName || b.vendorName || b.vendorId?.name || '';
              const cName = b.customerId?.name || b.customer_name || '';

              const matchesSearch = !bookingSearchTerm ||
                vName.toLowerCase().includes(bookingSearchTerm.toLowerCase()) ||
                cName.toLowerCase().includes(bookingSearchTerm.toLowerCase());

              const matchesStatus = bookingStatusFilter === 'All' || (b.status || '').toLowerCase() === bookingStatusFilter.toLowerCase();

              let matchesDate = true;
              if (bookingDateFilter !== 'All' && b.createdAt) {
                const bDate = new Date(b.createdAt);
                const now = new Date();
                if (bookingDateFilter === 'Today') {
                  matchesDate = bDate.toDateString() === now.toDateString();
                } else if (bookingDateFilter === 'Weekly') {
                  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  matchesDate = bDate >= sevenDaysAgo;
                } else if (bookingDateFilter === 'Monthly') {
                  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  matchesDate = bDate >= thirtyDaysAgo;
                }
              }

              return matchesSearch && matchesStatus && matchesDate;
            });

            return (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Bookings Management</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                    <span className="block text-slate-400 text-xs font-bold uppercase">Total Bookings</span>
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2 block">{filteredBookings.length}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                    <span className="block text-slate-400 text-xs font-bold uppercase">Total Volume</span>
                    <span className="text-3xl font-extrabold text-emerald-500 mt-2 block">₹{filteredBookings.reduce((sum, b) => sum + (b.amount || 0), 0).toLocaleString()}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                    <span className="block text-slate-400 text-xs font-bold uppercase">Total Commission</span>
                    <span className="text-3xl font-extrabold text-primary-500 mt-2 block">₹{filteredBookings.reduce((sum, b) => sum + (b.commission || 0), 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Toolbar / Search & Filter Controls */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-1 flex-wrap gap-3 w-full">
                      {/* Search Bar */}
                      <div className="flex gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl flex-1 min-w-[240px]">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search by vendor or customer name..." 
                          value={bookingSearchTerm}
                          onChange={(e) => setBookingSearchTerm(e.target.value)}
                          className="bg-transparent focus:outline-none text-sm w-full"
                        />
                      </div>

                      {/* Status Filter */}
                      <select
                        value={bookingStatusFilter}
                        onChange={(e) => setBookingStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>

                      {/* Date Filter */}
                      <select
                        value={bookingDateFilter}
                        onChange={(e) => setBookingDateFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Time</option>
                        <option value="Today">Today</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-4">Vendor</th>
                          <th className="px-6 py-4">Customer</th>
                          <th className="px-6 py-4">Booking Schedule</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Commission</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredBookings.map((booking) => {
                          const vName = booking.vendorId?.businessName || booking.vendorName || booking.vendorId?.name || 'Express Repair Services';
                          const cName = booking.customerId?.name || booking.customer_name || 'Uma Devi';
                          return (
                            <tr key={booking._id}>
                              <td className="px-6 py-4">
                                <span className="block font-semibold text-slate-850 dark:text-slate-100">{vName}</span>
                                <span className="text-xs text-slate-400">{booking.vendorId?.email || 'vendor@example.com'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="block font-semibold">{cName}</span>
                                <span className="text-xs text-slate-400">{booking.customerId?.phone || '1234567890'}</span>
                              </td>
                              <td className="px-6 py-4 text-xs font-semibold text-slate-750 dark:text-slate-300">
                                <div>📅 {booking.appointmentDate || (booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'N/A')}</div>
                                <div className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold mt-0.5">⌚ {booking.appointmentTimeSlot || 'Standard Slot'}</div>
                              </td>
                              <td className="px-6 py-4 font-bold text-emerald-500">₹{booking.amount}</td>
                              <td className="px-6 py-4 font-bold text-primary-500">₹{booking.commission}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold capitalize ${booking.status?.toLowerCase() === 'completed' || booking.status?.toLowerCase() === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' : booking.status?.toLowerCase() === 'cancelled' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                  {booking.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-400">{new Date(booking.createdAt).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                        {filteredBookings.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-slate-400 text-sm">
                              No bookings found matching search and filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 17. JOB APPLIED */}
          {activeTab === 'jobs' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Job Applications</h3>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="px-6 py-4">App ID</th>
                        <th className="px-6 py-4">Candidate & Cust ID</th>
                        <th className="px-6 py-4">Position & Company (HR)</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Resume</th>
                        <th className="px-6 py-4">Applied Date</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {jobs.map((job) => (
                        <tr key={job._id}>
                          <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">
                            #{String(job.applicationId || job._id).substring(0, 8).toUpperCase()}
                          </td>
                          <td className="px-6 py-4">
                            <span className="block font-bold text-slate-800 dark:text-slate-200">{job.candidateName}</span>
                            <span className="block text-[11px] text-slate-400 font-semibold mt-0.5">ID: {job.customerId}</span>
                            <span className="block text-xs text-slate-400 mt-0.5">{job.email} | {job.phone}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="block font-bold text-primary-500">{job.position}</span>
                            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{job.companyName || 'Connect Portal Inc.'}</span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">HR: {job.hrName || 'HR Team'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <select 
                              value={job.status} 
                              onChange={(e) => executeAction(`/admin/jobs/${job._id}`, 'PUT', { status: e.target.value })}
                              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-1"
                            >
                              <option value="applied">Applied</option>
                              <option value="interviewing">Interviewing</option>
                              <option value="selected">Selected</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            {job.resumeUrl ? (
                              <a 
                                href={job.resumeUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                              >
                                <FileText className="w-3.5 h-3.5" /> View Resume
                              </a>
                            ) : (
                              <span className="text-xs text-slate-450 italic">No Resume</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">{new Date(job.createdAt || job.appliedDate).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button 
                                onClick={() => {
                                  setModalData(job);
                                  setShowModal('view-job');
                                }}
                                className="text-primary-605 dark:text-primary-400 hover:underline text-xs font-bold"
                              >
                                View
                              </button>
                              <button 
                                onClick={() => executeAction(`/admin/jobs/${job._id}`, 'DELETE')}
                                className="text-rose-500 hover:text-rose-600 text-xs font-bold"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 18. MEMBERSHIP CARD HOLDER */}
          {activeTab === 'card-holders' && (() => {
            const filteredHolders = cardHolders.filter(h => {
              const matchesSearch = !cardHolderSearchTerm ||
                (h.name || '').toLowerCase().includes(cardHolderSearchTerm.toLowerCase()) ||
                (h.email || '').toLowerCase().includes(cardHolderSearchTerm.toLowerCase()) ||
                (h.phone || '').includes(cardHolderSearchTerm);

              const matchesType = cardHolderTypeFilter === 'All' || (h.cardType || '').toLowerCase() === cardHolderTypeFilter.toLowerCase();

              const matchesStatus = cardHolderStatusFilter === 'All' || (h.status || '').toLowerCase() === cardHolderStatusFilter.toLowerCase();

              let matchesExpiry = true;
              if (cardHolderExpiryFilter !== 'All' && h.expiryDate) {
                const expDate = new Date(h.expiryDate);
                const now = new Date();
                if (cardHolderExpiryFilter === 'Expired') {
                  matchesExpiry = expDate < now;
                } else if (cardHolderExpiryFilter === 'Active') {
                  matchesExpiry = expDate >= now;
                }
              }

              return matchesSearch && matchesType && matchesStatus && matchesExpiry;
            });

            return (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Membership Card Holders</h3>
                  <button 
                    onClick={() => setShowModal('card-holder')}
                    className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Add Card Holder
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-1 flex-wrap gap-3 w-full">
                      {/* Search Bar */}
                      <div className="flex gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl flex-1 min-w-[240px]">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search by name, email, or phone number..." 
                          value={cardHolderSearchTerm}
                          onChange={(e) => setCardHolderSearchTerm(e.target.value)}
                          className="bg-transparent focus:outline-none text-sm w-full"
                        />
                      </div>

                      {/* Card Type Filter */}
                      <select
                        value={cardHolderTypeFilter}
                        onChange={(e) => setCardHolderTypeFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Card Types</option>
                        <option value="Silver">Silver</option>
                        <option value="Gold">Gold</option>
                        <option value="Platinum">Platinum</option>
                      </select>

                      {/* Status Filter */}
                      <select
                        value={cardHolderStatusFilter}
                        onChange={(e) => setCardHolderStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                      </select>

                      {/* Expiry Date Filter */}
                      <select
                        value={cardHolderExpiryFilter}
                        onChange={(e) => setCardHolderExpiryFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Expiry Dates</option>
                        <option value="Active">Valid / Active</option>
                        <option value="Expired">Already Expired</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-4">Name</th>
                          <th className="px-6 py-4">Card Info</th>
                          <th className="px-6 py-4">Expiry</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredHolders.map((holder) => (
                          <tr key={holder._id}>
                            <td className="px-6 py-4">
                              <span className="block font-bold text-slate-800 dark:text-slate-200">{holder.name}</span>
                              <span className="text-xs text-slate-400">{holder.email} | {holder.phone}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${holder.cardType === 'Platinum' ? 'bg-purple-500/10 text-purple-500' : holder.cardType === 'Gold' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-400/10 text-slate-400'}`}>
                                {holder.cardType}
                              </span>
                              <span className="block font-mono text-[10px] text-slate-400 mt-1">{holder.cardNumber}</span>
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-300">{new Date(holder.expiryDate).toLocaleDateString()}</td>
                            <td className="px-6 py-4">
                              <select 
                                value={holder.status} 
                                onChange={(e) => executeAction(`/admin/card-holders/${holder._id}`, 'PUT', { status: e.target.value })}
                                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-1 font-semibold"
                              >
                                <option value="active">Active</option>
                                <option value="expired">Expired</option>
                                <option value="suspended">Suspended</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => executeAction(`/admin/card-holders/${holder._id}`, 'DELETE')}
                                className="text-rose-500 hover:text-rose-600 text-xs font-semibold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredHolders.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                              No card holders found matching search and filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 19. PAYMENTS */}
          {activeTab === 'payments' && (() => {
            const filteredPayments = payments.filter(p => {
              const userName = p.userId?.name || 'Super Admin';
              const titleVal = p.title || '';

              const matchesSearch = !paymentSearchTerm ||
                userName.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
                titleVal.toLowerCase().includes(paymentSearchTerm.toLowerCase());

              const matchesType = paymentTypeFilter === 'All' || (p.type || '').toLowerCase() === paymentTypeFilter.toLowerCase();

              const matchesStatus = paymentStatusFilter === 'All' || (p.status || '').toLowerCase() === paymentStatusFilter.toLowerCase();

              let matchesDate = true;
              if (paymentDateFilter !== 'All' && p.createdAt) {
                const pDate = new Date(p.createdAt);
                const now = new Date();
                if (paymentDateFilter === 'Today') {
                  matchesDate = pDate.toDateString() === now.toDateString();
                } else if (paymentDateFilter === 'Weekly') {
                  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  matchesDate = pDate >= sevenDaysAgo;
                } else if (paymentDateFilter === 'Monthly') {
                  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  matchesDate = pDate >= thirtyDaysAgo;
                }
              }

              return matchesSearch && matchesType && matchesStatus && matchesDate;
            });

            return (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Payments & Transactions</h3>
                  <button 
                    onClick={() => setShowModal('payment')}
                    className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Record Payment
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-1 flex-wrap gap-3 w-full">
                      {/* Search Bar */}
                      <div className="flex gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl flex-1 min-w-[240px]">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search by user name or transaction details..." 
                          value={paymentSearchTerm}
                          onChange={(e) => setPaymentSearchTerm(e.target.value)}
                          className="bg-transparent focus:outline-none text-sm w-full"
                        />
                      </div>

                      {/* Type Filter */}
                      <select
                        value={paymentTypeFilter}
                        onChange={(e) => setPaymentTypeFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Types</option>
                        <option value="credit">Credit</option>
                        <option value="debit">Debit</option>
                      </select>

                      {/* Status Filter */}
                      <select
                        value={paymentStatusFilter}
                        onChange={(e) => setPaymentStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Statuses</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                      </select>

                      {/* Date Filter */}
                      <select
                        value={paymentDateFilter}
                        onChange={(e) => setPaymentDateFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Time</option>
                        <option value="Today">Today</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Transaction Details</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredPayments.map((p) => (
                          <tr key={p._id}>
                            <td className="px-6 py-4">
                              <span className="block font-bold text-slate-800 dark:text-slate-200">{p.userId?.name || 'Super Admin'}</span>
                              <span className="text-[10px] text-slate-400 uppercase">{p.userId?.role || 'admin'}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="block font-semibold">{p.title}</span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">₹{p.amount}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold capitalize ${p.type === 'credit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {p.type}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold capitalize ${p.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : p.status === 'failed' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => {
                                    setModalData(p);
                                    setShowModal('edit-payment');
                                  }}
                                  className="text-primary-600 dark:text-primary-400 hover:underline text-xs font-bold flex items-center gap-1"
                                >
                                  <Edit2 className="w-3.5 h-3.5" /> Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredPayments.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-slate-400 text-sm">
                              No payment transactions found matching search and filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 20. DELIVERY PARTNER */}
          {activeTab === 'delivery-partners' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Delivery Partners</h3>
                <button 
                  onClick={() => { setOnboardType('delivery-partner'); setShowModal('delivery-partner'); }}
                  className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-lg"
                >
                  Onboard Delivery Partner
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="px-6 py-4">Partner Name</th>
                        <th className="px-6 py-4">Vehicle Details</th>
                        <th className="px-6 py-4">City</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {deliveryPartners
                        .filter(dp => dp.vehicleType?.toLowerCase() !== 'technician' && dp.vehicleType?.toLowerCase() !== 'executive')
                        .map((dp) => (
                          <tr key={dp._id}>
                            <td className="px-6 py-4">
                              <span className="block font-bold text-slate-800 dark:text-slate-200">{dp.name}</span>
                              <span className="text-xs text-slate-400">{dp.email} | {dp.phone}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="block font-semibold">{dp.vehicleType}</span>
                              <span className="text-xs text-slate-400">{dp.vehicleNumber || 'N/A'}</span>
                            </td>
                            <td className="px-6 py-4">{dp.city}</td>
                            <td className="px-6 py-4">
                              <select 
                                value={dp.status} 
                                onChange={(e) => executeAction(`/admin/delivery-partners/${dp._id}`, 'PUT', { status: e.target.value })}
                                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-1"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="suspended">Suspended</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => executeAction(`/admin/delivery-partners/${dp._id}`, 'DELETE')}
                                className="text-rose-500 hover:text-rose-600 text-xs font-semibold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TECHNICIANS TAB */}
          {activeTab === 'technicians' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Service Technicians</h3>
                <button 
                  onClick={() => { setOnboardType('technician'); setShowModal('delivery-partner'); }}
                  className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-lg"
                >
                  Onboard Technician
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="px-6 py-4">Technician Name</th>
                        <th className="px-6 py-4">Specialty / Role</th>
                        <th className="px-6 py-4">City</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {deliveryPartners
                        .filter(dp => dp.vehicleType?.toLowerCase() === 'technician')
                        .map((dp) => (
                          <tr key={dp._id}>
                            <td className="px-6 py-4">
                              <span className="block font-bold text-slate-800 dark:text-slate-200">{dp.name}</span>
                              <span className="text-xs text-slate-400">{dp.email} | {dp.phone}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-purple-500/10 text-purple-500 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
                                Service Specialist
                              </span>
                            </td>
                            <td className="px-6 py-4">{dp.city}</td>
                            <td className="px-6 py-4">
                              <select 
                                value={dp.status} 
                                onChange={(e) => executeAction(`/admin/delivery-partners/${dp._id}`, 'PUT', { status: e.target.value })}
                                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-1"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="suspended">Suspended</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => executeAction(`/admin/delivery-partners/${dp._id}`, 'DELETE')}
                                className="text-rose-500 hover:text-rose-600 text-xs font-semibold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* EXECUTIVES TAB */}
          {activeTab === 'executives' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Executives</h3>
                <button 
                  onClick={() => { setOnboardType('executive'); setShowModal('delivery-partner'); }}
                  className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-lg"
                >
                  Onboard Executive
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="px-6 py-4">Executive Name</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">City</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {deliveryPartners
                        .filter(dp => dp.vehicleType?.toLowerCase() === 'executive')
                        .map((dp) => (
                          <tr key={dp._id}>
                            <td className="px-6 py-4">
                              <span className="block font-bold text-slate-800 dark:text-slate-200">{dp.name}</span>
                              <span className="text-xs text-slate-400">{dp.email} | {dp.phone}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-blue-500/10 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
                                Operations Executive
                              </span>
                            </td>
                            <td className="px-6 py-4">{dp.city}</td>
                            <td className="px-6 py-4">
                              <select 
                                value={dp.status} 
                                onChange={(e) => executeAction(`/admin/delivery-partners/${dp._id}`, 'PUT', { status: e.target.value })}
                                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-1"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="suspended">Suspended</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => executeAction(`/admin/delivery-partners/${dp._id}`, 'DELETE')}
                                className="text-rose-500 hover:text-rose-600 text-xs font-semibold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 21. CUSTOMER SUPPORT TEAM */}
          {activeTab === 'support-team' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Customer Support Team</h3>
                <button 
                  onClick={() => setShowModal('support-team')}
                  className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-lg"
                >
                  Add Support Agent
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="px-6 py-4">Agent Name</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {supportTeam.map((st) => (
                        <tr key={st._id}>
                          <td className="px-6 py-4">
                            <span className="block font-bold text-slate-800 dark:text-slate-200">{st.name}</span>
                            <span className="text-xs text-slate-400">{st.email} | {st.phone}</span>
                          </td>
                          <td className="px-6 py-4 capitalize font-semibold text-primary-500">{st.role}</td>
                          <td className="px-6 py-4">
                            <select 
                              value={st.status} 
                              onChange={(e) => executeAction(`/admin/support-team/${st._id}`, 'PUT', { status: e.target.value })}
                              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-1"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => executeAction(`/admin/support-team/${st._id}`, 'DELETE')}
                              className="text-rose-500 hover:text-rose-600 text-xs font-semibold"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 22. CATEGORY MANAGEMENT */}
          {activeTab === 'categories' && (() => {
            // Helper icon renderer for categories
            const getCatIcon = (name, type = 'main') => {
              const iconClass = "w-4 h-4";
              const n = (name || '').toLowerCase();
              
              if (n.includes('product') || n.includes('bag')) return <ShoppingBag className={iconClass} />;
              if (n.includes('service') || n.includes('briefcase')) return <Briefcase className={iconClass} />;
              if (n.includes('daily') || n.includes('grocery') || n.includes('need')) return <Package className={iconClass} />;
              if (n.includes('food') || n.includes('restaurant') || n.includes('cafe')) return <Utensils className={iconClass} />;
              if (n.includes('offer') || n.includes('deal')) return <Tag className={iconClass} />;
              if (n.includes('mobile') || n.includes('phone') || n.includes('tablet')) return <Smartphone className={iconClass} />;
              if (n.includes('laptop') || n.includes('computer') || n.includes('desktop')) return <Laptop className={iconClass} />;
              if (n.includes('appliance') || n.includes('tv') || n.includes('electronic')) return <Tv className={iconClass} />;
              if (n.includes('fashion') || n.includes('cloth') || n.includes('wear')) return <Shirt className={iconClass} />;
              if (n.includes('home') || n.includes('furniture') || n.includes('house')) return <Home className={iconClass} />;
              if (n.includes('beauty') || n.includes('care') || n.includes('spa')) return <Sparkles className={iconClass} />;

              return type === 'main' ? <Folder className={iconClass} /> : <Layers className={iconClass} />;
            };

            // Build Category Hierarchy by merging TAXONOMY and DB categories
            const catTree = {};

            // 1. Load from predefined TAXONOMY
            Object.keys(TAXONOMY).forEach(mainName => {
              catTree[mainName] = {
                name: mainName,
                description: `${mainName} categories and items`,
                isActive: true,
                subcategories: {}
              };
              const subData = TAXONOMY[mainName];
              if (Array.isArray(subData)) {
                subData.forEach(subName => {
                  catTree[mainName].subcategories[subName] = {
                    name: subName,
                    description: `${subName} subcategory`,
                    isActive: true,
                    childCategories: []
                  };
                });
              } else if (subData && typeof subData === 'object') {
                Object.keys(subData).forEach(subName => {
                  catTree[mainName].subcategories[subName] = {
                    name: subName,
                    description: `${subName} subcategory`,
                    isActive: true,
                    childCategories: (subData[subName] || []).map(childName => ({
                      name: childName,
                      description: `${childName} category`,
                      isActive: true
                    }))
                  };
                });
              }
            });

            // 2. Merge database categories & process deletion markers
            (categories || []).forEach(c => {
              const mainName = c.name;
              if (!mainName) return;

              if (c.isDeleted || c.description === 'DELETED_HIERARCHY_MARKER') {
                if (catTree[mainName]) {
                  if (c.subcategory && catTree[mainName].subcategories?.[c.subcategory]) {
                    if (c.subSubcategory) {
                      catTree[mainName].subcategories[c.subcategory].childCategories = 
                        (catTree[mainName].subcategories[c.subcategory].childCategories || []).filter(ch => ch.name !== c.subSubcategory);
                    } else {
                      delete catTree[mainName].subcategories[c.subcategory];
                    }
                  } else if (!c.subcategory) {
                    delete catTree[mainName];
                  }
                }
                return;
              }

              if (!catTree[mainName]) {
                catTree[mainName] = {
                  _id: c._id,
                  name: mainName,
                  description: c.description || `${mainName} category`,
                  isActive: c.isActive !== undefined ? c.isActive : true,
                  subcategories: {}
                };
              } else if (!c.subcategory && !c.subSubcategory) {
                catTree[mainName]._id = c._id;
                if (c.description) catTree[mainName].description = c.description;
                if (c.isActive !== undefined) catTree[mainName].isActive = c.isActive;
              }

              if (c.subcategory) {
                const subName = c.subcategory;
                if (!catTree[mainName].subcategories[subName]) {
                  catTree[mainName].subcategories[subName] = {
                    _id: c._id,
                    name: subName,
                    description: c.description || `${subName} subcategory`,
                    isActive: c.isActive !== undefined ? c.isActive : true,
                    childCategories: []
                  };
                } else if (!c.subSubcategory) {
                  catTree[mainName].subcategories[subName]._id = c._id;
                  if (c.description) catTree[mainName].subcategories[subName].description = c.description;
                  if (c.isActive !== undefined) catTree[mainName].subcategories[subName].isActive = c.isActive;
                }

                if (c.subSubcategory) {
                  const childName = c.subSubcategory;
                  const childArr = catTree[mainName].subcategories[subName].childCategories;
                  const existingIdx = childArr.findIndex(ch => ch.name === childName);
                  if (existingIdx >= 0) {
                    childArr[existingIdx] = {
                      _id: c._id,
                      name: childName,
                      description: c.description || `${childName} category`,
                      isActive: c.isActive !== undefined ? c.isActive : true
                    };
                  } else {
                    childArr.push({
                      _id: c._id,
                      name: childName,
                      description: c.description || `${childName} category`,
                      isActive: c.isActive !== undefined ? c.isActive : true
                    });
                  }
                }
              }
            });

            // Compute KPI Counts
            const allMainCats = Object.values(catTree);
            let totalSubCatsCount = 0;
            let totalChildCatsCount = 0;
            let activeCount = 0;
            let inactiveCount = 0;

            allMainCats.forEach(m => {
              if (m.isActive !== false) activeCount++; else inactiveCount++;
              const subs = Object.values(m.subcategories || {});
              totalSubCatsCount += subs.length;
              subs.forEach(s => {
                if (s.isActive !== false) activeCount++; else inactiveCount++;
                const children = s.childCategories || [];
                totalChildCatsCount += children.length;
                children.forEach(ch => {
                  if (ch.isActive !== false) activeCount++; else inactiveCount++;
                });
              });
            });

            // Active selections & defaults
            const activeMainCatName = selectedMainCat && catTree[selectedMainCat] ? selectedMainCat : (allMainCats[0]?.name || "Products");
            const currentMainObj = catTree[activeMainCatName] || allMainCats[0] || { subcategories: {} };
            const allSubCatsForMain = Object.values(currentMainObj.subcategories || {});
            
            const activeSubCatName = selectedSubCat && currentMainObj.subcategories?.[selectedSubCat] 
              ? selectedSubCat 
              : (allSubCatsForMain[0]?.name || "");
            
            const currentSubObj = currentMainObj.subcategories?.[activeSubCatName] || allSubCatsForMain[0] || { childCategories: [] };
            const allChildCatsForSub = currentSubObj.childCategories || [];

            // Filters
            const filteredMainList = allMainCats.filter(m => {
              const matchesSearch = !catSearchTerm || 
                m.name.toLowerCase().includes(catSearchTerm.toLowerCase()) || 
                (m.description || '').toLowerCase().includes(catSearchTerm.toLowerCase());
              const matchesMain = catMainFilter === 'All' || m.name === catMainFilter;
              const matchesStatus = catStatusFilter === 'All Status' || 
                (catStatusFilter === 'Active' && m.isActive !== false) || 
                (catStatusFilter === 'Inactive' && m.isActive === false);
              return matchesSearch && matchesMain && matchesStatus;
            });

            const filteredSubList = allSubCatsForMain.filter(s => {
              const matchesSearch = !catSearchTerm || 
                s.name.toLowerCase().includes(catSearchTerm.toLowerCase()) || 
                (s.description || '').toLowerCase().includes(catSearchTerm.toLowerCase());
              const matchesSub = catSubFilter === 'All' || s.name === catSubFilter;
              const matchesStatus = catStatusFilter === 'All Status' || 
                (catStatusFilter === 'Active' && s.isActive !== false) || 
                (catStatusFilter === 'Inactive' && s.isActive === false);
              return matchesSearch && matchesSub && matchesStatus;
            });

            const filteredChildList = allChildCatsForSub.filter(ch => {
              const matchesSearch = !catSearchTerm || 
                ch.name.toLowerCase().includes(catSearchTerm.toLowerCase()) || 
                (ch.description || '').toLowerCase().includes(catSearchTerm.toLowerCase());
              const matchesStatus = catStatusFilter === 'All Status' || 
                (catStatusFilter === 'Active' && ch.isActive !== false) || 
                (catStatusFilter === 'Inactive' && ch.isActive === false);
              return matchesSearch && matchesStatus;
            });

            // Pagination slice
            const displayedMainList = filteredMainList;
            const displayedSubList = filteredSubList;
            const displayedChildList = filteredChildList;

            return (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Category Management</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>Dashboard</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">Category Management</span>
                    </div>
                  </div>
                </div>

                {/* 5 KPI Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Main Categories Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 shrink-0 flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Main Categories</p>
                      <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{allMainCats.length}</h4>
                      <p className="text-[10px] text-slate-400">All main categories</p>
                    </div>
                  </div>

                  {/* Sub Categories Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 shrink-0 flex items-center justify-center">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sub Categories</p>
                      <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{totalSubCatsCount}</h4>
                      <p className="text-[10px] text-slate-400">All sub categories</p>
                    </div>
                  </div>

                  {/* Child Categories Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 shrink-0 flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Child Categories</p>
                      <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{totalChildCatsCount}</h4>
                      <p className="text-[10px] text-slate-400">All child categories</p>
                    </div>
                  </div>

                  {/* Active Categories Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 shrink-0 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Categories</p>
                      <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{activeCount}</h4>
                      <p className="text-[10px] text-slate-400">Currently active</p>
                    </div>
                  </div>

                  {/* Inactive Categories Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 shrink-0 flex items-center justify-center">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Inactive Categories</p>
                      <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{inactiveCount}</h4>
                      <p className="text-[10px] text-slate-400">Currently inactive</p>
                    </div>
                  </div>
                </div>

                {/* Filter & Toolbar */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col xl:flex-row gap-3 items-center justify-between">
                  <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
                    {/* Search Input */}
                    <div className="relative min-w-[220px] flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        value={catSearchTerm}
                        onChange={(e) => setCatSearchTerm(e.target.value)}
                        placeholder="Search categories..."
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    {/* Main Category Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-500 hidden sm:inline">Main Category</label>
                      <select 
                        value={catMainFilter}
                        onChange={(e) => {
                          setCatMainFilter(e.target.value);
                          if (e.target.value !== 'All') setSelectedMainCat(e.target.value);
                        }}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 [&>option]:bg-white [&>option]:dark:bg-slate-950"
                      >
                        <option value="All">All</option>
                        {allMainCats.map(m => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Sub Category Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-500 hidden sm:inline">Sub Category</label>
                      <select 
                        value={catSubFilter}
                        onChange={(e) => {
                          setCatSubFilter(e.target.value);
                          if (e.target.value !== 'All') setSelectedSubCat(e.target.value);
                        }}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 [&>option]:bg-white [&>option]:dark:bg-slate-950"
                      >
                        <option value="All">All</option>
                        {allSubCatsForMain.map(s => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-500 hidden sm:inline">Status</label>
                      <select 
                        value={catStatusFilter}
                        onChange={(e) => setCatStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 [&>option]:bg-white [&>option]:dark:bg-slate-950"
                      >
                        <option value="All Status">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>

                    {/* Reset Button */}
                    <button 
                      onClick={() => {
                        setCatSearchTerm("");
                        setCatMainFilter("All");
                        setCatSubFilter("All");
                        setCatStatusFilter("All Status");
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                  </div>

                </div>

                {/* 3-Column Cascading Category Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
                  {/* Column 1: Main Categories */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col justify-between min-h-[500px]">
                    <div>
                      <div className="flex justify-between items-center pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          1. Main Categories ({filteredMainList.length})
                        </h3>
                      </div>

                      <div className="space-y-3 max-h-[550px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
                          {displayedMainList.map((mainItem) => {
                            const isSelected = activeMainCatName === mainItem.name;
                            return (
                              <div 
                                key={mainItem.name}
                                onClick={() => {
                                  setSelectedMainCat(mainItem.name);
                                  const firstSub = Object.keys(mainItem.subcategories || {})[0];
                                  if (firstSub) setSelectedSubCat(firstSub);
                                }}
                                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group flex items-center justify-between ${
                                  isSelected 
                                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20 shadow-sm' 
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40 shrink-0">
                                    {getCatIcon(mainItem.name, 'main')}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{mainItem.name}</h4>
                                    <p className="text-[11px] text-slate-400 truncate max-w-[130px]">{mainItem.description}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${mainItem.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                      <span className={`text-[10px] font-bold ${mainItem.isActive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                        {mainItem.isActive !== false ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="bg-indigo-100/70 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-900/50">
                                    {Object.keys(mainItem.subcategories || {}).length}
                                  </span>
                                  
                                  <div className="relative">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCatMenuId(activeCatMenuId === `main-${mainItem.name}` ? null : `main-${mainItem.name}`);
                                      }}
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                    {activeCatMenuId === `main-${mainItem.name}` && (
                                      <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 py-1 text-xs">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveCatMenuId(null);
                                            setModalData(mainItem);
                                            setShowModal('edit-category');
                                          }}
                                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300"
                                        >
                                          Edit
                                        </button>
                                        <button 
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setActiveCatMenuId(null);
                                            if (mainItem._id) {
                                              await executeAction(`/admin/categories/${mainItem._id}`, 'PUT', { isActive: !mainItem.isActive });
                                            }
                                          }}
                                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300"
                                        >
                                          Toggle Status
                                        </button>
                                        <button 
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setActiveCatMenuId(null);
                                            if (confirm(`Are you sure you want to delete main category "${mainItem.name}" and all its subcategories?`)) {
                                              if (mainItem._id) {
                                                await executeAction(`/admin/categories/${mainItem._id}`, 'DELETE');
                                              }
                                              await executeAction(`/admin/categories-hierarchy?name=${encodeURIComponent(mainItem.name)}`, 'DELETE');
                                            }
                                          }}
                                          className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-rose-600 dark:text-rose-400"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {isSelected && (
                                  <div className="hidden lg:block absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-indigo-600 text-white rounded-full p-1 shadow-md">
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* Column 2: Sub Categories */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col justify-between min-h-[500px]">
                      <div>
                        <div className="flex justify-between items-center pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            2. Sub Categories ({filteredSubList.length}) <span className="text-slate-400 font-normal">- {activeMainCatName}</span>
                          </h3>
                          <button 
                            onClick={() => {
                              setAddFirstCategory(activeMainCatName);
                              setCategoryModalTier('sub');
                              setShowModal('category');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-2.5 py-1 rounded-lg transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add
                          </button>
                        </div>

                        <div className="space-y-3 max-h-[550px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
                          {displayedSubList.map((subItem) => {
                            const isSelected = activeSubCatName === subItem.name;
                            return (
                              <div 
                                key={subItem.name}
                                onClick={() => setSelectedSubCat(subItem.name)}
                                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group flex items-center justify-between ${
                                  isSelected 
                                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20 shadow-sm' 
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 shrink-0">
                                    {getCatIcon(subItem.name, 'sub')}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{subItem.name}</h4>
                                    <p className="text-[11px] text-slate-400 truncate max-w-[130px]">{subItem.description}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${subItem.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                      <span className={`text-[10px] font-bold ${subItem.isActive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                        {subItem.isActive !== false ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="bg-indigo-100/70 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-900/50">
                                    {(subItem.childCategories || []).length}
                                  </span>
                                  
                                  <div className="relative">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCatMenuId(activeCatMenuId === `sub-${subItem.name}` ? null : `sub-${subItem.name}`);
                                      }}
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                    {activeCatMenuId === `sub-${subItem.name}` && (
                                      <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 py-1 text-xs">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveCatMenuId(null);
                                            setModalData({ ...subItem, name: activeMainCatName, subcategory: subItem.name });
                                            setShowModal('edit-category');
                                          }}
                                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300"
                                        >
                                          Edit
                                        </button>
                                        <button 
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setActiveCatMenuId(null);
                                            if (subItem._id) {
                                              await executeAction(`/admin/categories/${subItem._id}`, 'PUT', { isActive: !subItem.isActive });
                                            }
                                          }}
                                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300"
                                        >
                                          Toggle Status
                                        </button>
                                        <button 
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setActiveCatMenuId(null);
                                            if (confirm(`Are you sure you want to delete subcategory "${subItem.name}"?`)) {
                                              if (subItem._id) {
                                                await executeAction(`/admin/categories/${subItem._id}`, 'DELETE');
                                              }
                                              await executeAction(`/admin/categories-hierarchy?name=${encodeURIComponent(activeMainCatName)}&subcategory=${encodeURIComponent(subItem.name)}`, 'DELETE');
                                            }
                                          }}
                                          className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-rose-600 dark:text-rose-400"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {isSelected && (
                                  <div className="hidden lg:block absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-indigo-600 text-white rounded-full p-1 shadow-md">
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* Column 3: Child Categories */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col justify-between min-h-[500px]">
                      <div>
                        <div className="flex justify-between items-center pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            3. Child Categories ({filteredChildList.length}) <span className="text-slate-400 font-normal">- {activeSubCatName}</span>
                          </h3>
                          <button 
                            onClick={() => {
                              setAddFirstCategory(activeMainCatName);
                              setAddSecondCategory(activeSubCatName);
                              setCategoryModalTier('child');
                              setShowModal('category');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-2.5 py-1 rounded-lg transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add
                          </button>
                        </div>

                        <div className="space-y-3 max-h-[550px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
                          {displayedChildList.map((childItem) => (
                            <div 
                              key={childItem.name}
                              className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 font-bold text-xs uppercase flex items-center justify-center w-10 h-10">
                                  {childItem.name.substring(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{childItem.name}</h4>
                                  <p className="text-[11px] text-slate-400 truncate max-w-[130px]">{childItem.description || `${childItem.name} category`}</p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${childItem.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                    <span className={`text-[10px] font-bold ${childItem.isActive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                      {childItem.isActive !== false ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="relative shrink-0">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCatMenuId(activeCatMenuId === `child-${childItem.name}` ? null : `child-${childItem.name}`);
                                  }}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {activeCatMenuId === `child-${childItem.name}` && (
                                  <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 py-1 text-xs">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCatMenuId(null);
                                        setModalData({ ...childItem, name: activeMainCatName, subcategory: activeSubCatName, subSubcategory: childItem.name });
                                        setShowModal('edit-category');
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300"
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setActiveCatMenuId(null);
                                        if (childItem._id) {
                                          await executeAction(`/admin/categories/${childItem._id}`, 'PUT', { isActive: !childItem.isActive });
                                        }
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300"
                                    >
                                      Toggle Status
                                    </button>
                                    <button 
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setActiveCatMenuId(null);
                                        if (confirm(`Are you sure you want to delete child category "${childItem.name}"?`)) {
                                          if (childItem._id) {
                                            await executeAction(`/admin/categories/${childItem._id}`, 'DELETE');
                                          }
                                          await executeAction(`/admin/categories-hierarchy?name=${encodeURIComponent(activeMainCatName)}&subcategory=${encodeURIComponent(activeSubCatName)}&subSubcategory=${encodeURIComponent(childItem.name)}`, 'DELETE');
                                        }
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-rose-600 dark:text-rose-400"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>

                {/* Category Management Guide */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                    {/* Guide Info */}
                    <div className="flex items-center gap-4 min-w-0 lg:max-w-[40%]">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shrink-0 flex items-center justify-center">
                        <Layers className="w-7 h-7" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Category Management Guide</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Organize your marketplace with a 3-level category structure for better navigation and user experience.</p>
                      </div>
                    </div>

                    {/* Guide Feature Cards */}
                    <div className="flex flex-1 flex-wrap lg:flex-nowrap gap-3 w-full lg:w-auto">
                      <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5 border border-slate-100 dark:border-slate-700/50 flex-1 min-w-[140px]">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Hierarchical Structure</p>
                          <p className="text-[10px] text-slate-400">Organize in 3 levels</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5 border border-slate-100 dark:border-slate-700/50 flex-1 min-w-[140px]">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Settings className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Easy Management</p>
                          <p className="text-[10px] text-slate-400">Add, edit, delete easily</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5 border border-slate-100 dark:border-slate-700/50 flex-1 min-w-[140px]">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Better Navigation</p>
                          <p className="text-[10px] text-slate-400">Improved user experience</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5 border border-slate-100 dark:border-slate-700/50 flex-1 min-w-[140px]">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Search className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">SEO Friendly</p>
                          <p className="text-[10px] text-slate-400">Better visibility in search</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 23. QUERIES */}
          {activeTab === 'queries' && (() => {
            const filteredQueries = queries.filter(q => {
              const uType = q.userType || q.role || 'Customer';
              
              const matchesSearch = !querySearchTerm ||
                (q.name || '').toLowerCase().includes(querySearchTerm.toLowerCase()) ||
                (q.email || '').toLowerCase().includes(querySearchTerm.toLowerCase()) ||
                (q.subject || '').toLowerCase().includes(querySearchTerm.toLowerCase()) ||
                (q.message || '').toLowerCase().includes(querySearchTerm.toLowerCase());

              const matchesUserType = queryUserTypeFilter === 'All' || uType.toLowerCase() === queryUserTypeFilter.toLowerCase();

              const matchesStatus = queryStatusFilter === 'All' || (q.status || '').toLowerCase() === queryStatusFilter.toLowerCase();

              return matchesSearch && matchesUserType && matchesStatus;
            });

            return (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Customer & Partner Queries</h3>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex flex-1 flex-wrap gap-3 w-full">
                      {/* Search Bar */}
                      <div className="flex gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl flex-1 min-w-[240px]">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search by name, email, or query content..." 
                          value={querySearchTerm}
                          onChange={(e) => setQuerySearchTerm(e.target.value)}
                          className="bg-transparent focus:outline-none text-sm w-full"
                        />
                      </div>

                      {/* User Type Filter */}
                      <select
                        value={queryUserTypeFilter}
                        onChange={(e) => setQueryUserTypeFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All User Types</option>
                        <option value="Customer">Customer</option>
                        <option value="Vendor">Vendor</option>
                        <option value="Agent">Agent</option>
                      </select>

                      {/* Status Filter */}
                      <select
                        value={queryStatusFilter}
                        onChange={(e) => setQueryStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <option value="All">All Statuses</option>
                        <option value="unread">Unread</option>
                        <option value="read">Read</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-4">From</th>
                          <th className="px-6 py-4">User Type</th>
                          <th className="px-6 py-4">Query Details</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredQueries.map((q) => {
                          const uType = q.userType || q.role || 'Customer';
                          return (
                            <tr key={q._id}>
                              <td className="px-6 py-4">
                                <span className="block font-bold text-slate-800 dark:text-slate-200">{q.name}</span>
                                <span className="text-xs text-slate-400">{q.email} | {q.phone || 'N/A'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${uType === 'Vendor' ? 'bg-amber-500/10 text-amber-500' : uType === 'Agent' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                  {uType}
                                </span>
                              </td>
                              <td className="px-6 py-4 space-y-1">
                                <span className="block font-bold text-primary-500">{q.subject}</span>
                                <p className="text-xs text-slate-600 dark:text-slate-400 italic max-w-md whitespace-pre-line">"{q.message}"</p>
                                <span className="block text-[10px] text-slate-400">{new Date(q.createdAt).toLocaleString()}</span>
                              </td>
                              <td className="px-6 py-4">
                                <select 
                                  value={q.status} 
                                  onChange={(e) => executeAction(`/admin/queries/${q._id}`, 'PUT', { status: e.target.value })}
                                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-1 font-semibold"
                                >
                                  <option value="unread">Unread</option>
                                  <option value="read">Read</option>
                                  <option value="resolved">Resolved</option>
                                </select>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => executeAction(`/admin/queries/${q._id}`, 'DELETE')}
                                  className="text-rose-500 hover:text-rose-600 text-xs font-semibold"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredQueries.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                              No queries found matching search and filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 24. SUPPORT */}
          {activeTab === 'tickets' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Customer Support Tickets</h3>
                <button 
                  onClick={() => setShowModal('ticket')}
                  className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-lg"
                >
                  Create Support Ticket
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="px-6 py-4">Ticket ID</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Issue</th>
                        <th className="px-6 py-4">Priority</th>
                        <th className="px-6 py-4">Assigned To</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {tickets.map((t) => (
                        <tr key={t._id}>
                          <td className="px-6 py-4 font-mono font-bold text-slate-850 dark:text-slate-100">{t.ticketId}</td>
                          <td className="px-6 py-4">
                            <span className="block font-semibold">{t.customerName}</span>
                            <span className="text-xs text-slate-400">{t.phone || 'No phone'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs max-w-xs">{t.issue}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold capitalize ${t.priority === 'high' ? 'bg-rose-500/10 text-rose-500' : t.priority === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-500'}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <select 
                              value={t.assignedTo || ''} 
                              onChange={(e) => executeAction(`/admin/tickets/${t._id}`, 'PUT', { assignedTo: e.target.value })}
                              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-1"
                            >
                              <option value="">Unassigned</option>
                              {supportTeam.map((agent) => (
                                <option key={agent._id} value={agent.name}>{agent.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <select 
                              value={t.status} 
                              onChange={(e) => executeAction(`/admin/tickets/${t._id}`, 'PUT', { status: e.target.value })}
                              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs p-1 font-semibold"
                            >
                              <option value="open">Open</option>
                              <option value="in-progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => executeAction(`/admin/tickets/${t._id}`, 'DELETE')}
                              className="text-rose-500 hover:text-rose-600 text-xs font-semibold"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 25. ANNOUNCEMENT */}
          {activeTab === 'announcements' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">System Announcements</h3>
                <button 
                  onClick={() => setShowModal('announcement')}
                  className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-lg"
                >
                  Create Announcement
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {announcements.map((ann) => (
                  <div key={ann._id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-slate-850 dark:text-slate-100 text-base">{ann.title}</span>
                        <button 
                          onClick={() => executeAction(`/admin/announcements/${ann._id}`, 'DELETE')}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{ann.content}</p>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold bg-primary-600/10 text-primary-550 px-2 py-0.5 rounded-full">
                        Audience: {ann.targetAudience}
                      </span>
                      <button 
                        onClick={() => executeAction(`/admin/announcements/${ann._id}`, 'PUT', { isActive: !ann.isActive })}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ann.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}
                      >
                        {ann.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* SYSTEM SETTINGS VIEW */}

        </main>
      </div>

      {/* MODALS */}
      {showModal === 'branch' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {modalData ? 'Modify District details' : 'Create New District'}
            </h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const name = e.target.name.value;
                const code = e.target.code.value;
                const state = e.target.state.value;
                const district = e.target.district.value;
                const city = e.target.city.value;
                const address = e.target.address.value;
                const contactNumber = e.target.contactNumber.value;
                const agentId = e.target.agentId.value || null;
                
                if (modalData) {
                  await executeAction(`/admin/branches/${modalData._id}`, 'PUT', { name, code, state, district, city, address, contactNumber, agentId });
                } else {
                  await executeAction('/admin/branches', 'POST', { name, code, state, district, city, address, contactNumber, agentId });
                }
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">District Name</label>
                  <input 
                    name="name" 
                    defaultValue={modalData?.name || ''} 
                    onChange={(e) => {
                      if (modalData) return;
                      const val = e.target.value;
                      const form = e.target.form;
                      if (!form) return;
                      
                      let codeVal = '';
                      if (val.length >= 3) {
                        codeVal = val.substring(0, 3).toUpperCase() + '01';
                      } else if (val.length > 0) {
                        codeVal = val.toUpperCase() + '01';
                      }
                      
                      const districtMap = {
                        'mumbai': { state: 'Maharashtra', city: 'Mumbai', code: 'MUM01' },
                        'delhi': { state: 'Delhi', city: 'Delhi', code: 'DEL01' },
                        'bangalore': { state: 'Karnataka', city: 'Bengaluru', code: 'BLR01' },
                        'bengaluru': { state: 'Karnataka', city: 'Bengaluru', code: 'BLR01' },
                        'chennai': { state: 'Tamil Nadu', city: 'Chennai', code: 'CHN01' },
                        'kolkata': { state: 'West Bengal', city: 'Kolkata', code: 'KOL01' },
                        'hyderabad': { state: 'Telangana', city: 'Hyderabad', code: 'HYD01' },
                        'pune': { state: 'Maharashtra', city: 'Pune', code: 'PUN01' },
                        'ahmedabad': { state: 'Gujarat', city: 'Ahmedabad', code: 'AMD01' },
                        'jaipur': { state: 'Rajasthan', city: 'Jaipur', code: 'JAI01' },
                        'lucknow': { state: 'Uttar Pradesh', city: 'Lucknow', code: 'LKO01' },
                        'patna': { state: 'Bihar', city: 'Patna', code: 'PAT01' },
                        'coimbatore': { state: 'Tamil Nadu', city: 'Coimbatore', code: 'CBE01' },
                        'madurai': { state: 'Tamil Nadu', city: 'Madurai', code: 'MDU01' },
                        'surat': { state: 'Gujarat', city: 'Surat', code: 'SUR01' },
                        'kanpur': { state: 'Uttar Pradesh', city: 'Kanpur', code: 'KAN01' },
                        'nagpur': { state: 'Maharashtra', city: 'Nagpur', code: 'NAG01' },
                        'indore': { state: 'Madhya Pradesh', city: 'Indore', code: 'IND01' },
                        'bhopal': { state: 'Madhya Pradesh', city: 'Bhopal', code: 'BHO01' },
                        'visakhapatnam': { state: 'Andhra Pradesh', city: 'Visakhapatnam', code: 'VTZ01' },
                        'vadodara': { state: 'Gujarat', city: 'Vadodara', code: 'BDQ01' },
                        'kochi': { state: 'Kerala', city: 'Kochi', code: 'COK01' },
                        'thiruvananthapuram': { state: 'Kerala', city: 'Thiruvananthapuram', code: 'TRV01' }
                      };
                      
                      const key = val.trim().toLowerCase();
                      const matched = districtMap[key];
                      
                      if (matched) {
                        form.code.value = matched.code;
                        form.state.value = matched.state;
                        form.district.value = val;
                        form.city.value = matched.city;
                        form.address.value = `${matched.city}, ${matched.state}`;
                        form.contactNumber.value = '9876543210';
                      } else {
                        form.code.value = codeVal;
                        form.district.value = val;
                        form.city.value = val;
                        form.state.value = '';
                        form.address.value = val ? `${val} Central Office` : '';
                        form.contactNumber.value = val ? '9876543210' : '';
                      }
                    }}
                    required 
                    type="text" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">District Code</label>
                  <input name="code" defaultValue={modalData?.code || ''} required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">State</label>
                  <input name="state" defaultValue={modalData?.state || ''} required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">District</label>
                  <input name="district" defaultValue={modalData?.district || ''} required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">City</label>
                  <input name="city" defaultValue={modalData?.city || ''} required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Address</label>
                <input name="address" defaultValue={modalData?.address || ''} required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Contact Number</label>
                <input name="contactNumber" defaultValue={modalData?.contactNumber || ''} required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">District Controlling Agent</label>
                <select name="agentId" defaultValue={modalData?.agentId?._id || modalData?.agentId || ''} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  <option value="">-- Select Controlling Agent --</option>
                  {agents.map(a => (
                    <option key={a._id} value={a._id}>{a.name} ({a.email})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-200 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  Save District
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'admin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {modalData ? 'Edit Admin User' : 'Register Admin'}
            </h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const name = e.target.name.value;
                const email = e.target.email.value;
                const password = e.target.password.value;
                const adminRole = e.target.adminRole.value;
                const branchId = e.target.branchId.value || null;
                
                const payload = { name, email, adminRole, branchId };
                if (password) payload.password = password;

                if (modalData) {
                  await executeAction(`/admin/admins/${modalData._id}`, 'PUT', payload);
                } else {
                  await executeAction('/admin/admins', 'POST', payload);
                }
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Name</label>
                <input name="name" required defaultValue={modalData?.name || ''} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Email</label>
                <input name="email" required defaultValue={modalData?.email || ''} type="email" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                  Password {modalData && '(Leave blank to keep current)'}
                </label>
                <input name="password" required={!modalData} type="password" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Role</label>
                <select name="adminRole" defaultValue={modalData?.adminRole || 'branch-admin'} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  <option value="branch-admin">District Admin</option>
                  <option value="staff">Staff</option>
                  <option value="super-admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">District Assignment</label>
                <select name="branchId" defaultValue={modalData?.branchId?._id || modalData?.branchId || ''} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  <option value="">None (Global)</option>
                  {branches.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  {modalData ? 'Save Changes' : 'Register Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'pincode' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Assign Pincode to Agent</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const pincodeId = e.target.pincodeId.value;
                const agentId = e.target.agentId.value;
                await executeAction('/admin/pincodes/assign', 'POST', { pincodeId, agentId });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Pincode</label>
                <select name="pincodeId" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  {pincodes.map(p => (
                    <option key={p._id} value={p._id}>{p.code} ({p.name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Agent</label>
                <select name="agentId" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  {agents.map(a => (
                    <option key={a._id} value={a._id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'plan' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {modalData ? 'Edit Membership Plan' : 'Create Membership Plan'}
            </h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const name = e.target.name.value;
                const price = Number(e.target.price.value);
                const duration = Number(e.target.duration.value);
                const features = e.target.features.value.split(',').map(f => f.trim());
                
                if (modalData) {
                  await executeAction(`/admin/memberships/plans/${modalData._id}`, 'PUT', { name, price, duration, features });
                } else {
                  await executeAction('/admin/memberships/plans', 'POST', { name, price, duration, features });
                }
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Plan Name</label>
                <input name="name" required type="text" defaultValue={modalData ? modalData.name : ''} placeholder="e.g. Gold Tier" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Price (INR)</label>
                  <input name="price" required type="number" defaultValue={modalData ? modalData.price : ''} placeholder="2499" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Duration (Days)</label>
                  <input name="duration" required type="number" defaultValue={modalData ? modalData.duration : ''} placeholder="90" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Features (comma separated)</label>
                <input name="features" required type="text" defaultValue={modalData ? modalData.features.join(', ') : ''} placeholder="Priority listing, SMS alerts, Weekly analytics" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  {modalData ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'banner' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Add Promotional Banner</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const title = e.target.title.value;
                const mediaType = e.target.mediaType.value;
                const imageUrl = e.target.imageUrl?.value || '';
                const videoUrl = e.target.videoUrl?.value || '';
                const targetAudience = e.target.targetAudience.value;
                const redirectLink = e.target.redirectLink.value;
                const startDate = new Date();
                const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                
                await executeAction('/admin/banners', 'POST', { 
                  title, mediaType, imageUrl, videoUrl, targetAudience, redirectLink, startDate, endDate 
                });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Title</label>
                <input name="title" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Media Type</label>
                  <select name="mediaType" defaultValue="image" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">For Whom (Audience)</label>
                  <select name="targetAudience" defaultValue="all" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                    <option value="all">All</option>
                    <option value="vendor">Vendor</option>
                    <option value="agent">Agent</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Image URL</label>
                <div className="flex gap-2 items-center">
                  <input 
                    name="imageUrl" 
                    value={bannerImageUrl} 
                    onChange={(e) => setBannerImageUrl(e.target.value)} 
                    type="text" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" 
                  />
                  <label className="bg-[#b8860b] hover:bg-[#966d09] text-white text-xs font-bold px-3.5 py-2.5 rounded-xl cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs transition-all border-none">
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const img = new window.Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              let width = img.width;
                              let height = img.height;
                              const maxDim = 1200;
                              if (width > maxDim || height > maxDim) {
                                if (width > height) {
                                  height = Math.round((height * maxDim) / width);
                                  width = maxDim;
                                } else {
                                  width = Math.round((width * maxDim) / height);
                                  height = maxDim;
                                }
                              }
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx.drawImage(img, 0, 0, width, height);
                              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                              setBannerImageUrl(compressedDataUrl);
                            };
                            img.src = evt.target.result;
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Video URL (Optional)</label>
                <div className="flex gap-2 items-center">
                  <input 
                    name="videoUrl" 
                    value={bannerVideoUrl} 
                    onChange={(e) => setBannerVideoUrl(e.target.value)} 
                    placeholder="e.g. https://example.com/promo.mp4" 
                    type="text" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" 
                  />
                  <label className="bg-[#b8860b] hover:bg-[#966d09] text-white text-xs font-bold px-3.5 py-2.5 rounded-xl cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs transition-all border-none">
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload</span>
                    <input 
                      type="file" 
                      accept="video/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            setBannerVideoUrl(evt.target.result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Redirect Link</label>
                <input name="redirectLink" required type="text" placeholder="/promotions" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  Publish Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'ad' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Launch Advertisement</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const title = e.target.title.value;
                const mediaType = e.target.mediaType.value;
                const imageUrl = e.target.imageUrl?.value || '';
                const videoUrl = e.target.videoUrl?.value || '';
                const targetAudience = e.target.targetAudience.value;
                const redirectLink = e.target.redirectLink.value;
                
                await executeAction('/admin/ads', 'POST', { 
                  title, mediaType, imageUrl, videoUrl, targetAudience, redirectLink 
                });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Ad Title</label>
                <input name="title" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Media Type</label>
                  <select name="mediaType" defaultValue="image" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">For Whom (Audience)</label>
                  <select name="targetAudience" defaultValue="all" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                    <option value="all">All</option>
                    <option value="vendor">Vendor</option>
                    <option value="agent">Agent</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Image URL</label>
                <input name="imageUrl" defaultValue="https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600" type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Video URL (Optional)</label>
                <input name="videoUrl" placeholder="e.g. https://example.com/promo.mp4" type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Redirect URL</label>
                <input name="redirectLink" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  Launch Ad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'create-pincode' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Create New Pincode</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const pincode = e.target.pincode.value;
                const postOffice = e.target.postOffice.value;
                const district = e.target.district.value;
                const state = e.target.state.value;
                
                await executeAction('/admin/save-pincode', 'POST', { pincode, postOffice, district, state });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Pincode / Zip Code</label>
                <input name="pincode" required type="text" placeholder="e.g. 600001" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Post Office Name</label>
                <input name="postOffice" required type="text" placeholder="e.g. Chennai GPO" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">District</label>
                <input name="district" required type="text" placeholder="e.g. Chennai" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">State</label>
                <input name="state" required type="text" placeholder="e.g. Tamil Nadu" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  Save Pincode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'assign-task' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Assign Task to Agent</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const assignedTo = e.target.assignedTo.value;
                const title = e.target.title.value;
                const description = e.target.description.value;
                const dueDate = e.target.dueDate.value;
                
                await executeAction('/admin/assign-task', 'POST', { assignedTo, title, description, dueDate });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Select Agent</label>
                <select name="assignedTo" defaultValue={modalData?.agentId || ''} required className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  <option value="" disabled>-- Select an Agent --</option>
                  {agents.filter(a => a.status === 'approved').map(a => (
                    <option key={a._id} value={a._id}>{a.name} ({a.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Task Title</label>
                <input name="title" required type="text" placeholder="e.g. Verify documents for Hospital tie-up" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Description</label>
                <textarea name="description" placeholder="Provide detailed instructions..." className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm h-24" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Due Date</label>
                <input name="dueDate" required type="date" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'edit-agent' && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Edit Agent Details</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const name = e.target.name.value;
                const email = e.target.email.value;
                const phone = e.target.phone.value;
                const level = e.target.level.value;
                const assignedArea = e.target.assignedArea.value;
                const pincode = e.target.pincode.value;
                const isActive = e.target.isActive.checked;
                
                await executeAction(`/admin/update-agent/${modalData._id}`, 'PUT', { name, email, phone, level, assignedArea, pincode });
                await executeAction(`/admin/activate-agent/${modalData._id}`, 'PUT', { isActive });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Name</label>
                <input name="name" required defaultValue={modalData.name || ''} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Email</label>
                  <input name="email" required defaultValue={modalData.email || ''} type="email" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Phone</label>
                  <input name="phone" required defaultValue={modalData.phone || ''} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Agent Level</label>
                  <select name="level" defaultValue={modalData.level || 'pincode'} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                    <option value="state">State</option>
                    <option value="district">District</option>
                    <option value="division">Division</option>
                    <option value="pincode">Pincode</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Assigned Area</label>
                  <input name="assignedArea" defaultValue={modalData.assignedArea || ''} type="text" placeholder="State/Dist name" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Assigned Pincode</label>
                  <input name="pincode" defaultValue={modalData.assignedPincode?.code || ''} type="text" placeholder="e.g. 600001" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input name="isActive" id="isActive" defaultChecked={modalData.isActive || false} type="checkbox" className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300" />
                  <label htmlFor="isActive" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Is Profile Active</label>
                </div>
              </div>
              
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'edit-tieup' && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Edit Business Tie-Up Request</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const businessName = e.target.businessName.value;
                const category = e.target.category.value;
                const serviceType = e.target.serviceType.value;
                const location = e.target.location.value;
                const pincode = e.target.pincode.value;
                const businessLicense = e.target.businessLicense.value;
                const status = e.target.status.value;
                
                await executeAction(`/admin/tie-up/${modalData._id}`, 'PUT', { businessName, category, serviceType, location, pincode, businessLicense, status });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Business Name</label>
                <input name="businessName" required defaultValue={modalData.businessName || ''} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Category</label>
                  <select name="category" defaultValue={modalData.category || 'Products'} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm [&>option]:bg-white [&>option]:dark:bg-slate-950">
                    {Array.from(new Set([...Object.keys(TAXONOMY), ...(categories || []).map(c => c.name)])).filter(Boolean).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Subcategory (Service Type)</label>
                  <input name="serviceType" required defaultValue={modalData.serviceType || ''} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Location</label>
                <input name="location" required defaultValue={modalData.location || ''} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Pincode</label>
                  <input name="pincode" required defaultValue={modalData.pincode || ''} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">License / Registration</label>
                  <input name="businessLicense" defaultValue={modalData.businessLicense || ''} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Status</label>
                <select name="status" defaultValue={modalData.status || 'pending'} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'create-agent' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Register New Agent</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const name = e.target.name.value;
                const email = e.target.email.value;
                const phone = e.target.phone.value;
                const password = e.target.password.value;
                const confirmPassword = e.target.confirmPassword.value;
                const level = e.target.level.value;
                const assignedArea = e.target.assignedArea.value;
                const pincode = e.target.pincode.value;
                const status = e.target.status.value;
                
                if (password !== confirmPassword) {
                  addToast("Passwords do not match!", 'error');
                  return;
                }

                const bankDetails = {
                  upiId: e.target.upiId.value,
                  bankName: e.target.bankName.value,
                  accountNumber: e.target.accountNumber.value,
                  ifscCode: e.target.ifscCode.value,
                };
                
                await executeAction('/admin/create-agent', 'POST', { 
                  name, email, phone, password, level, assignedArea, pincode, status, bankDetails 
                });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Agent Name</label>
                <input name="name" required type="text" placeholder="e.g. John Doe" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Email Address</label>
                  <input name="email" required type="email" placeholder="john@example.com" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Phone Number</label>
                  <input name="phone" required type="text" placeholder="9876543210" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Password</label>
                  <div className="relative">
                    <input 
                      name="password" 
                      required 
                      type={showAgentPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-3.5 pr-10 py-2 text-sm" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowAgentPassword(!showAgentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showAgentPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Confirm Password</label>
                  <div className="relative">
                    <input 
                      name="confirmPassword" 
                      required 
                      type={showAgentConfirmPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-3.5 pr-10 py-2 text-sm" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowAgentConfirmPassword(!showAgentConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showAgentConfirmPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Agent Level</label>
                  <select name="level" defaultValue="pincode" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                    <option value="state">State</option>
                    <option value="district">District</option>
                    <option value="division">Division</option>
                    <option value="pincode">Pincode</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Assigned Area</label>
                  <input name="assignedArea" type="text" placeholder="e.g. Tamil Nadu / Chennai" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Assigned Pincode</label>
                  <input name="pincode" type="text" placeholder="e.g. 600001" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Initial KYC Status</label>
                  <select name="status" defaultValue="approved" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                    <option value="approved">Approved & Active</option>
                    <option value="pending">Pending KYC Review</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payment / Payout Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">UPI ID</label>
                    <input name="upiId" type="text" placeholder="e.g. name@upi" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Bank Name</label>
                    <input name="bankName" type="text" placeholder="e.g. HDFC Bank" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Account Number</label>
                    <input name="accountNumber" type="text" placeholder="Account Number" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">IFSC Code</label>
                    <input name="ifscCode" type="text" placeholder="IFSC Code" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">
                  Cancel
                </button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  Register Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 26. CREATE JOB MODAL */}
      {showModal === 'job' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">New Job Application</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const candidateName = e.target.candidateName.value;
                const email = e.target.email.value;
                const phone = e.target.phone.value;
                const position = e.target.position.value;
                const experience = e.target.experience.value;
                await executeAction('/admin/jobs', 'POST', { candidateName, email, phone, position, experience });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Candidate Name</label>
                <input name="candidateName" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Email Address</label>
                  <input name="email" required type="email" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Phone Number</label>
                  <input name="phone" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Position</label>
                <input name="position" required placeholder="e.g. Sales Associate" type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Experience</label>
                <input name="experience" placeholder="e.g. 2 Years" type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">Add Application</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW JOB APPLICATION MODAL */}
      {showModal === 'view-job' && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 space-y-6 overflow-y-auto max-h-[90vh] shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Candidate Job Application Details</h3>
              <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-lg">
                #{String(modalData.applicationId || modalData._id).toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Candidate Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-primary-500 uppercase tracking-wider">Candidate Information</h4>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Candidate Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{modalData.candidateName}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Customer ID</span>
                  <span className="font-semibold text-slate-805 dark:text-slate-300">{modalData.customerId}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Email Address</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{modalData.email}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Phone Number</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{modalData.phone}</span>
                </div>
              </div>

              {/* Job & Company Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-primary-500 uppercase tracking-wider">Job & Company Details</h4>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Position / Role</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{modalData.position}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Company Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{modalData.companyName || 'Connect Portal Inc.'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">HR Name</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{modalData.hrName || 'HR Team'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Experience</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{modalData.experience || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Resume & Status */}
            <div className="space-y-4 pt-3 border-t dark:border-slate-800">
              <h4 className="text-xs font-bold text-primary-500 uppercase tracking-wider">Status & Documents</h4>
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase mb-2">Resume / CV</span>
                  {modalData.resumeUrl ? (
                    <a 
                      href={modalData.resumeUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all w-full justify-center"
                    >
                      <FileText className="w-4 h-4" /> View Resume Document
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic block py-2">No resume provided.</span>
                  )}
                </div>
                <div className="flex-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase mb-2">Application Status</span>
                  <select 
                    value={modalData.status} 
                    onChange={(e) => {
                      executeAction(`/admin/jobs/${modalData._id}`, 'PUT', { status: e.target.value });
                      setModalData({ ...modalData, status: e.target.value });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3.5 py-2.5 font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <option value="applied">Applied</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="selected">Selected</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Applied Date</span>
                <span className="text-xs text-slate-500 font-medium">
                  {new Date(modalData.createdAt || modalData.appliedDate).toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    hour: 'numeric', minute: 'numeric'
                  })}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t dark:border-slate-800">
              <button 
                type="button" 
                onClick={() => setShowModal(null)} 
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 27. CREATE CARD HOLDER MODAL */}
      {showModal === 'card-holder' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">New Card Holder</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const name = e.target.name.value;
                const email = e.target.email.value;
                const phone = e.target.phone.value;
                const cardType = e.target.cardType.value;
                const cardNumber = e.target.cardNumber.value;
                const expiryDate = e.target.expiryDate.value;
                await executeAction('/admin/card-holders', 'POST', { name, email, phone, cardType, cardNumber, expiryDate });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Name</label>
                <input name="name" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Email Address</label>
                  <input name="email" required type="email" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Phone Number</label>
                  <input name="phone" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Card Type</label>
                  <select name="cardType" defaultValue="Gold" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                    <option value="Platinum">Platinum</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Card Number</label>
                  <input name="cardNumber" required placeholder="e.g. CARD-998877" type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Expiry Date</label>
                <input name="expiryDate" required type="date" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">Add Holder</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 28. RECORD PAYMENT MODAL */}
      {showModal === 'payment' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Record New Transaction</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const title = e.target.title.value;
                const amount = Number(e.target.amount.value);
                const type = e.target.type.value;
                const status = e.target.status.value;
                await executeAction('/admin/payments', 'POST', { title, amount, type, status });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Transaction Title</label>
                <input name="title" placeholder="e.g. Agent commission payout" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Amount (₹)</label>
                  <input name="amount" required type="number" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Type</label>
                  <select name="type" defaultValue="credit" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                    <option value="credit">Credit (Inflow)</option>
                    <option value="debit">Debit (Outflow)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Status</label>
                <select name="status" defaultValue="completed" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">Record Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 29. ONBOARD DELIVERY PARTNER */}
      {showModal === 'delivery-partner' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {onboardType === 'technician' ? 'Onboard Technician' : onboardType === 'executive' ? 'Onboard Executive' : 'Onboard Delivery Partner'}
            </h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const name = e.target.name.value;
                const email = e.target.email.value;
                const phone = e.target.phone.value;
                const vehicleType = onboardType !== 'delivery-partner' ? onboardType : e.target.vehicleType.value;
                const vehicleNumber = onboardType !== 'delivery-partner' ? 'N/A' : e.target.vehicleNumber.value;
                const city = e.target.city.value;
                await executeAction('/admin/delivery-partners', 'POST', { name, email, phone, vehicleType, vehicleNumber, city });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Name</label>
                <input name="name" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Email Address</label>
                  <input name="email" required type="email" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Phone Number</label>
                  <input name="phone" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              {onboardType === 'delivery-partner' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Vehicle Type</label>
                    <input name="vehicleType" required placeholder="e.g. Motorcycle / Van" type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Vehicle Number</label>
                    <input name="vehicleNumber" required placeholder="e.g. DL-3C-AB-1234" type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">City</label>
                <input name="city" required placeholder="e.g. Delhi" type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                  {onboardType === 'technician' ? 'Onboard Technician' : onboardType === 'executive' ? 'Onboard Executive' : 'Onboard Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 30. ADD SUPPORT AGENT */}
      {showModal === 'support-team' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Add Customer Support Agent</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const name = e.target.name.value;
                const email = e.target.email.value;
                const phone = e.target.phone.value;
                const role = e.target.role.value;
                await executeAction('/admin/support-team', 'POST', { name, email, phone, role });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Agent Name</label>
                <input name="name" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Email Address</label>
                  <input name="email" required type="email" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Phone Number</label>
                  <input name="phone" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Support Role</label>
                <select name="role" defaultValue="agent" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  <option value="agent">Support Executive</option>
                  <option value="manager">Support Manager</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">Add Agent</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 31. ADD CATEGORY */}
      {showModal === 'category' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {categoryModalTier === 'child' ? 'Add New Child Category' : 'Add New Sub Category'}
            </h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const name = e.target.name.value;
                const subcategory = e.target.subcategory.value;
                const subSubcategory = categoryModalTier === 'child' ? (e.target.subSubcategory?.value || '') : '';
                const description = e.target.description.value;
                await executeAction('/admin/categories', 'POST', { name, subcategory, subSubcategory, description });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">First Category (Main Name)</label>
                <input 
                  name="name" 
                  value={addFirstCategory} 
                  readOnly 
                  disabled 
                  className="w-full bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed font-semibold" 
                />
              </div>

              {categoryModalTier === 'sub' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Second Category (Sub Category Name)</label>
                  <input 
                    name="subcategory" 
                    placeholder="Enter sub category name (e.g. Mobiles & Tablets)" 
                    required 
                    type="text" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" 
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Second Category (Sub Name)</label>
                    <input 
                      name="subcategory" 
                      value={addSecondCategory} 
                      readOnly 
                      disabled 
                      className="w-full bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed font-semibold" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Third Category (Child Name)</label>
                    <input 
                      name="subSubcategory" 
                      placeholder="Enter child category (e.g. Apple)" 
                      required 
                      type="text" 
                      className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" 
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Description</label>
                <textarea name="description" placeholder="Description of the category..." className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm min-h-[80px]" />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">Add Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 32. CREATE SUPPORT TICKET */}
      {showModal === 'ticket' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Create Support Ticket</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const customerName = e.target.customerName.value;
                const phone = e.target.phone.value;
                const issue = e.target.issue.value;
                const priority = e.target.priority.value;
                await executeAction('/admin/tickets', 'POST', { customerName, phone, issue, priority });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Customer Name</label>
                <input name="customerName" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Phone Number</label>
                <input name="phone" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Issue / Description</label>
                <textarea name="issue" required placeholder="Customer issue details..." className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm min-h-[80px]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Priority</label>
                <select name="priority" defaultValue="medium" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">Create Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 33. CREATE ANNOUNCEMENT */}
      {showModal === 'announcement' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">New Announcement</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const title = e.target.title.value;
                const content = e.target.content.value;
                const targetAudience = e.target.targetAudience.value;
                await executeAction('/admin/announcements', 'POST', { title, content, targetAudience });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Title</label>
                <input name="title" required type="text" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Content</label>
                <textarea name="content" required placeholder="Announcement content..." className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm min-h-[100px]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Target Audience</label>
                <select name="targetAudience" defaultValue="all" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm">
                  <option value="all">All Users</option>
                  <option value="vendors">Vendors</option>
                  <option value="agents">Agents</option>
                  <option value="customers">Customers</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">Publish Announcement</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 34. KYC DOCUMENT PREVIEW MODAL */}
      {kycPreviewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 cursor-pointer"
          onClick={() => setKycPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center justify-center">
            <button 
              onClick={() => setKycPreviewImage(null)} 
              className="absolute top-[-40px] right-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors cursor-pointer text-sm font-bold border border-white/10"
            >
              ✕ Close Preview
            </button>
            <img 
              src={kycPreviewImage} 
              alt="KYC Document Preview" 
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10 cursor-default"
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}

      {/* 35. VENDOR DETAILS MODAL */}
      {showModal === 'vendor-details' && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-3xl rounded-3xl p-6 space-y-6 my-8">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{modalData.businessName}</h3>
                <span className="text-xs text-slate-400">Created: {new Date(modalData.createdAt).toLocaleDateString()}</span>
              </div>
              <button 
                onClick={() => setShowModal(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-4">
                <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">Business Details</h4>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-2">
                  <div className="flex justify-between"><span className="text-slate-400">Category:</span><span className="font-semibold">{modalData.category}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Subcategory:</span><span className="font-semibold">{modalData.subcategory || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Base Type:</span><span className="font-semibold">{modalData.baseVendorType || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Status:</span><span className="font-semibold capitalize">{modalData.status}</span></div>
                </div>

                <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">Contact Information</h4>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-2">
                  <div className="flex justify-between"><span className="text-slate-400">Contact Person:</span><span className="font-semibold">{modalData.contactName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Phone:</span><span className="font-semibold">{modalData.phone}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Email:</span><span className="font-semibold truncate max-w-[200px]">{modalData.email}</span></div>
                  {modalData.address && (
                    <div className="flex justify-between"><span className="text-slate-400">Address:</span><span className="font-semibold text-right max-w-[200px] break-words">{modalData.address}</span></div>
                  )}
                </div>

                <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">Performance & Platform</h4>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-2">
                  <div className="flex justify-between"><span className="text-slate-400">Total Orders:</span><span className="font-semibold">{modalData.totalOrders || 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Total Revenue:</span><span className="font-bold text-emerald-500">₹{modalData.totalRevenue || 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Total Bookings:</span><span className="font-semibold">{modalData.totalBookings || 0}</span></div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">KYC Documents & Verification</h4>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-3">
                  <div className="flex justify-between"><span className="text-slate-400">KYC Status:</span><span className="font-bold capitalize">{modalData.kycStatus}</span></div>
                  
                  {modalData.kycDocs && (
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      {modalData.kycDocs.aadhaarNumber && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Aadhaar:</span>
                          <span className="font-semibold">{modalData.kycDocs.aadhaarNumber}</span>
                        </div>
                      )}
                      {modalData.kycDocs.aadhaarImage && (
                        <button 
                          onClick={() => setKycPreviewImage(modalData.kycDocs.aadhaarImage)}
                          className="w-full text-center text-xs text-primary-500 hover:underline font-bold bg-primary-500/5 py-1.5 rounded-lg border border-primary-500/10 block"
                        >
                          View Aadhaar Document
                        </button>
                      )}
                      
                      {modalData.kycDocs.panNumber && (
                        <div className="flex justify-between items-center text-xs pt-2">
                          <span className="text-slate-400">PAN:</span>
                          <span className="font-semibold">{modalData.kycDocs.panNumber}</span>
                        </div>
                      )}
                      {modalData.kycDocs.panImage && (
                        <button 
                          onClick={() => setKycPreviewImage(modalData.kycDocs.panImage)}
                          className="w-full text-center text-xs text-primary-500 hover:underline font-bold bg-primary-500/5 py-1.5 rounded-lg border border-primary-500/10 block"
                        >
                          View PAN Document
                        </button>
                      )}
                      
                      {modalData.kycDocs.selfie && (
                        <button 
                          onClick={() => setKycPreviewImage(modalData.kycDocs.selfie)}
                          className="w-full text-center text-xs text-primary-500 hover:underline font-bold bg-primary-500/5 py-1.5 rounded-lg border border-primary-500/10 block"
                        >
                          View Selfie Profile
                        </button>
                      )}
                      
                      {modalData.kycDocs.businessProofImage && (
                        <button 
                          onClick={() => setKycPreviewImage(modalData.kycDocs.businessProofImage)}
                          className="w-full text-center text-xs text-primary-500 hover:underline font-bold bg-primary-500/5 py-1.5 rounded-lg border border-primary-500/10 block"
                        >
                          View Business Proof Document
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {modalData.bankDetails && (
                  <>
                    <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">Payment & Bank Details</h4>
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-2">
                      {modalData.bankDetails.upiId && <div className="flex justify-between text-xs"><span className="text-slate-400">UPI ID:</span><span className="font-semibold">{modalData.bankDetails.upiId}</span></div>}
                      {modalData.bankDetails.bankName && <div className="flex justify-between text-xs"><span className="text-slate-400">Bank Name:</span><span className="font-semibold">{modalData.bankDetails.bankName}</span></div>}
                      {modalData.bankDetails.accountNumber && <div className="flex justify-between text-xs"><span className="text-slate-400">Account Number:</span><span className="font-semibold">{modalData.bankDetails.accountNumber}</span></div>}
                      {modalData.bankDetails.ifscCode && <div className="flex justify-between text-xs"><span className="text-slate-400">IFSC Code:</span><span className="font-semibold">{modalData.bankDetails.ifscCode}</span></div>}
                    </div>
                  </>
                )}

                <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">Membership & Referral</h4>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-2">
                  <div className="flex justify-between"><span className="text-slate-400">Membership Tier:</span><span className="font-bold text-amber-500 uppercase">{modalData.membership?.status === 'active' ? 'PRO MEMBER' : 'FREE TIER'}</span></div>
                  {modalData.membership?.expiryDate && (
                    <div className="flex justify-between"><span className="text-slate-400">Expires:</span><span>{new Date(modalData.membership.expiryDate).toLocaleDateString()}</span></div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Onboarding Agent:</span>
                    <span>{modalData.agentId?.name || 'Direct Sign-Up'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => setShowModal(null)} 
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 36. AGENT DETAILS MODAL */}
      {showModal === 'agent-details' && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-3xl rounded-3xl p-6 space-y-6 my-8">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <img 
                  src={modalData.kyc?.selfie || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                  alt="" 
                  className="w-12 h-12 rounded-xl object-cover" 
                />
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{modalData.name}</h3>
                  <span className="text-xs text-slate-400">Registered: {new Date(modalData.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-4">
                <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">Agent Details</h4>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-2">
                  <div className="flex justify-between"><span className="text-slate-400">Role:</span><span className="font-semibold capitalize">{modalData.role}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Level:</span><span className="font-semibold capitalize">{modalData.level || 'pincode'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Assigned Area:</span><span className="font-semibold">{modalData.assignedArea || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Assigned Pincode:</span><span className="font-bold text-primary-500">{modalData.assignedPincode?.code || 'None'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Status:</span><span className="font-semibold capitalize">{modalData.status}</span></div>
                </div>

                <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">Contact Information</h4>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-2">
                  <div className="flex justify-between"><span className="text-slate-400">Phone:</span><span className="font-semibold">{modalData.phone}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Email:</span><span className="font-semibold truncate max-w-[200px]">{modalData.email}</span></div>
                </div>

                {modalData.bankDetails && (
                  <>
                    <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">Payment & Payout Details</h4>
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-2">
                      {modalData.bankDetails.upiId && <div className="flex justify-between text-xs"><span className="text-slate-400">UPI ID:</span><span className="font-semibold">{modalData.bankDetails.upiId}</span></div>}
                      {modalData.bankDetails.bankName && <div className="flex justify-between text-xs"><span className="text-slate-400">Bank Name:</span><span className="font-semibold">{modalData.bankDetails.bankName}</span></div>}
                      {modalData.bankDetails.accountNumber && <div className="flex justify-between text-xs"><span className="text-slate-400">Account Number:</span><span className="font-semibold">{modalData.bankDetails.accountNumber}</span></div>}
                      {modalData.bankDetails.ifscCode && <div className="flex justify-between text-xs"><span className="text-slate-400">IFSC Code:</span><span className="font-semibold">{modalData.bankDetails.ifscCode}</span></div>}
                    </div>
                  </>
                )}

                <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">Performance & Financials</h4>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-2">
                  <div className="flex justify-between"><span className="text-slate-400">Wallet Balance:</span><span className="font-bold text-emerald-500">₹{modalData.balance || 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Commission Earned:</span><span className="font-bold text-primary-500">₹{modalData.commissionEarned || 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Vendors Onboarded:</span><span className="font-bold">{modalData.vendorsAdded || 0}</span></div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-primary-500 uppercase text-xs tracking-wider">KYC Documents</h4>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-3">
                  {modalData.kyc ? (
                    <div className="space-y-3">
                      {modalData.kyc.aadhaarNumber && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Aadhaar:</span>
                          <span className="font-semibold">{modalData.kyc.aadhaarNumber}</span>
                        </div>
                      )}
                      {modalData.kyc.aadhaarImage && (
                        <button 
                          onClick={() => setKycPreviewImage(modalData.kyc.aadhaarImage)}
                          className="w-full text-center text-xs text-primary-500 hover:underline font-bold bg-primary-500/5 py-1.5 rounded-lg border border-primary-500/10 block"
                        >
                          View Aadhaar Document
                        </button>
                      )}
                      
                      {modalData.kyc.panNumber && (
                        <div className="flex justify-between items-center text-xs pt-2">
                          <span className="text-slate-400">PAN:</span>
                          <span className="font-semibold">{modalData.kyc.panNumber}</span>
                        </div>
                      )}
                      {modalData.kyc.panImage && (
                        <button 
                          onClick={() => setKycPreviewImage(modalData.kyc.panImage)}
                          className="w-full text-center text-xs text-primary-500 hover:underline font-bold bg-primary-500/5 py-1.5 rounded-lg border border-primary-500/10 block"
                        >
                          View PAN Document
                        </button>
                      )}
                      
                      {modalData.kyc.selfie && (
                        <button 
                          onClick={() => setKycPreviewImage(modalData.kyc.selfie)}
                          className="w-full text-center text-xs text-primary-500 hover:underline font-bold bg-primary-500/5 py-1.5 rounded-lg border border-primary-500/10 block"
                        >
                          View Selfie Profile
                        </button>
                      )}
                      
                      {modalData.kyc.businessProofImage && (
                        <button 
                          onClick={() => setKycPreviewImage(modalData.kyc.businessProofImage)}
                          className="w-full text-center text-xs text-primary-500 hover:underline font-bold bg-primary-500/5 py-1.5 rounded-lg border border-primary-500/10 block"
                        >
                          View Business Proof Document
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-center py-4">No KYC documents uploaded</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => setShowModal(null)} 
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 37. EDIT CATEGORY MODAL */}
      {showModal === 'edit-category' && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Edit Category Hierarchy</h3>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const subcategory = e.target.subcategory.value;
                const subSubcategory = e.target.subSubcategory.value;
                const description = e.target.description.value;
                await executeAction(`/admin/categories/${modalData._id}`, 'PUT', { subcategory, subSubcategory, description });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">First Category (Non-Editable)</label>
                <input 
                  disabled 
                  value={modalData.name} 
                  type="text" 
                  className="w-full bg-slate-100 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm text-slate-500 cursor-not-allowed" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Second Category (Sub)</label>
                  <input 
                    name="subcategory" 
                    defaultValue={modalData.subcategory || ''} 
                    type="text" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Third Category (Sub-sub)</label>
                  <input 
                    name="subSubcategory" 
                    defaultValue={modalData.subSubcategory || ''} 
                    type="text" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Description</label>
                <textarea 
                  name="description" 
                  defaultValue={modalData.description || ''} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3.5 py-2 text-sm min-h-[80px]" 
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-sm font-semibold px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BANK & PERSON DETAILS MODAL */}
      {showModal === 'bank-details' && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl p-6 space-y-6 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Applicant & Bank Details</h3>
                <p className="text-xs text-slate-400">Withdrawal Request #{String(modalData._id).substring(0, 8)}</p>
              </div>
              <button onClick={() => setShowModal(null)} className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Section 1: Requesting Person Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary-500">1. Requesting Person Profile</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Full Name</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 block mt-0.5">{modalData.agentId?.name || modalData.accountHolderName || 'Amit Sharma'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Email Address</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">{modalData.agentId?.email || 'amit@example.com'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Phone Number</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">{modalData.agentId?.phone || '9876543210'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Role / Level</span>
                    <span className="font-bold text-purple-500 capitalize block mt-0.5">{modalData.agentId?.level || modalData.agentId?.role || 'Pincode Agent'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Assigned Location</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">{modalData.agentId?.assignedDistrict || 'New Delhi'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Wallet Balance</span>
                    <span className="font-extrabold text-emerald-500 block mt-0.5">₹{modalData.agentId?.balance || 7500}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Commission Earned</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">₹{modalData.agentId?.commissionEarned || 3500}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Vendors Added</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">{modalData.agentId?.vendorsAdded || 4} Vendors</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Aadhaar / PAN</span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 block mt-0.5">
                      {modalData.agentId?.kyc?.aadhaarNumber || '123456789012'} | {modalData.agentId?.kyc?.panNumber || 'ABCDE1234F'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Bank Account & Payout Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-500">2. Bank & Pay-out Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Account Holder Name</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 block mt-0.5">{modalData.accountHolderName || modalData.agentId?.name || 'Amit Sharma'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Bank Name</span>
                    <span className="text-sm font-bold text-primary-500 block mt-0.5">{modalData.bankName || 'HDFC Bank'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Account Number</span>
                    <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 block mt-0.5">{modalData.accountNumber || '987654321098'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">IFSC Code</span>
                    <span className="text-sm font-mono font-bold text-emerald-500 block mt-0.5">{modalData.ifscCode || 'HDFC0001234'}</span>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs">
                  <p><strong>Branch Name:</strong> {modalData.branchName || 'Connaught Place, New Delhi'}</p>
                  <p><strong>Withdrawal Amount Requested:</strong> <span className="text-rose-500 font-extrabold text-lg">₹{modalData.amount}</span></p>
                  <p><strong>Request Date & Time:</strong> {new Date(modalData.createdAt).toLocaleString()}</p>
                  <p><strong>Current Request Status:</strong> <span className="capitalize font-bold text-slate-800 dark:text-slate-100">{modalData.status}</span></p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="button" 
                onClick={() => setShowModal(null)} 
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl"
              >
                Close
              </button>
              {modalData.status === 'pending' && (
                <>
                  <button 
                    type="button" 
                    onClick={async () => {
                      await executeAction(`/admin/wallet/withdrawals/${modalData._id}`, 'PUT', { status: 'rejected' });
                      setShowModal(null);
                    }} 
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold px-4 py-2.5 rounded-xl"
                  >
                    Reject Request
                  </button>
                  <button 
                    type="button" 
                    onClick={async () => {
                      await executeAction(`/admin/wallet/withdrawals/${modalData._id}`, 'PUT', { status: 'approved' });
                      setShowModal(null);
                    }} 
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md"
                  >
                    Approve Pay-out
                  </button>
                </>
              )}
              {modalData.status === 'approved' && (
                <button 
                  type="button" 
                  onClick={async () => {
                    await executeAction(`/admin/wallet/withdrawals/${modalData._id}`, 'PUT', { status: 'completed' });
                    setShowModal(null);
                  }} 
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md"
                >
                  Mark as Completed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT PAYMENT TRANSACTION MODAL */}
      {showModal === 'edit-payment' && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Edit Payment Transaction</h3>
              <button onClick={() => setShowModal(null)} className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const title = e.target.title.value;
                const amount = Number(e.target.amount.value);
                const type = e.target.type.value;
                const status = e.target.status.value;
                await executeAction(`/admin/payments/${modalData._id}`, 'PUT', { title, amount, type, status });
                setShowModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Transaction Title / Details</label>
                <input 
                  name="title" 
                  defaultValue={modalData.title || ''} 
                  required 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Amount (₹)</label>
                <input 
                  name="amount" 
                  defaultValue={modalData.amount || 0} 
                  required 
                  type="number" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Transaction Type</label>
                  <select 
                    name="type" 
                    defaultValue={modalData.type || 'credit'} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Payment Status</label>
                  <select 
                    name="status" 
                    defaultValue={modalData.status || 'completed'} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowModal(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl">Cancel</button>
                <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- SLEEK TOAST NOTIFICATIONS -------------------- */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        {toasts.map((t) => {
          const isError = t.type === 'error' || (t.text || '').toLowerCase().includes('failed') || (t.text || '').toLowerCase().includes('error') || (t.text || '').toLowerCase().includes('denied') || (t.text || '').toLowerCase().includes('rejected');
          const isSuccess = t.type === 'success' || (t.text || '').toLowerCase().includes('success') || (t.text || '').toLowerCase().includes('added') || (t.text || '').toLowerCase().includes('saved') || (t.text || '').toLowerCase().includes('approved') || (t.text || '').toLowerCase().includes('created');

          return (
            <div 
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 transform translate-y-0 ${
                isError 
                  ? 'bg-rose-950/90 text-rose-100 border-rose-800/60 shadow-rose-950/40' 
                  : isSuccess 
                  ? 'bg-emerald-950/90 text-emerald-100 border-emerald-800/60 shadow-emerald-950/40'
                  : 'bg-slate-900/90 text-slate-100 border-slate-700/60 shadow-slate-950/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {isError ? (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                ) : isSuccess ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <Sparkles className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                )}
                <span className="text-xs font-bold leading-snug break-words">{t.text}</span>
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border-none shrink-0"
              >
                <XCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
