/**
 * seedMainCategories.js
 * Seeds the 7 system-locked Main Categories + all default Sub & Child categories
 * from the TAXONOMY into the new hierarchical Category model.
 *
 * Usage: node seedMainCategories.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Category = require('./models/Category');

const slugify = (str) => str.toLowerCase().replace(/[&]/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
    "Fashion": ["Men - Shirts", "Men - T-Shirts", "Men - Jeans", "Men - Footwear", "Men - Watches", "Men - Accessories", "Women - Sarees", "Women - Kurtis", "Women - Dresses", "Women - Footwear", "Women - Handbags", "Women - Jewelry", "Kids - Clothing", "Kids - School Accessories", "Kids - Footwear", "Kids - Toys"],
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

const MAIN_DESCRIPTIONS = {
  "Services": "Repairs, salon, cleaning, tutoring and professional services",
  "Products": "Products categories and items",
  "Daily Needs": "Daily Needs categories and items",
  "Food": "Food categories and items",
  "Stay": "Stay categories and items",
  "Travel": "Travel categories and items",
  "Jobs": "Jobs categories and items"
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing categories
    await Category.deleteMany({});
    console.log('🗑️  Cleared existing categories');

    let totalMain = 0, totalSub = 0, totalChild = 0;

    for (const [mainName, subData] of Object.entries(TAXONOMY)) {
      // Create Main Category (SYSTEM LOCKED)
      const mainCat = await Category.create({
        level: 'main',
        name: mainName,
        slug: slugify(mainName),
        parentId: null,
        isSystem: true,
        isEditable: false,
        isDeletable: false,
        isActive: true,
        isVisible: true,
        description: MAIN_DESCRIPTIONS[mainName] || `${mainName} categories and items`,
        sortOrder: totalMain
      });
      totalMain++;
      console.log(`🔒 Main: ${mainName} (id: ${mainCat._id})`);

      let subOrder = 0;
      for (const [subName, children] of Object.entries(subData)) {
        // Create Sub Category
        const subCat = await Category.create({
          level: 'sub',
          name: subName,
          slug: slugify(subName),
          parentId: mainCat._id,
          isSystem: false,
          isEditable: true,
          isDeletable: true,
          isActive: true,
          isVisible: true,
          description: `${subName} subcategory`,
          sortOrder: subOrder
        });
        totalSub++;
        subOrder++;

        // Create Child Categories
        let childOrder = 0;
        for (const childName of children) {
          await Category.create({
            level: 'child',
            name: childName,
            slug: slugify(childName),
            parentId: subCat._id,
            isSystem: false,
            isEditable: true,
            isDeletable: true,
            isActive: true,
            isVisible: true,
            description: `${childName} category`,
            sortOrder: childOrder
          });
          totalChild++;
          childOrder++;
        }
      }
    }

    console.log(`\n✅ Seed complete!`);
    console.log(`   🔒 Main Categories: ${totalMain}`);
    console.log(`   📁 Sub Categories:  ${totalSub}`);
    console.log(`   📄 Child Categories: ${totalChild}`);
    console.log(`   📊 Total:           ${totalMain + totalSub + totalChild}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
