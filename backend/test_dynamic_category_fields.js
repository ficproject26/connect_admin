const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function testDynamicFieldsFlow() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    console.log('=== Step 1: Configuring Laptop Category in Admin Database ===');
    const Category = require('./models/Category');
    let laptopCat = await Category.findOne({ subSubcategory: 'Laptop' });
    if (!laptopCat) {
        laptopCat = await Category.findOne({ subcategory: 'Laptop' });
    }

    if (laptopCat) {
        laptopCat.requiredVendorFields = ['RAM', 'Display Size', 'Processor', 'Storage'];
        await laptopCat.save();
        console.log('✅ Updated existing category Laptop with requiredVendorFields:', laptopCat.requiredVendorFields);
    } else {
        const newCat = await Category.create({
            level: 'child',
            name: 'Products',
            subcategory: 'Computers',
            subSubcategory: 'Laptop',
            slug: 'laptop-' + Date.now(),
            requiredVendorFields: ['RAM', 'Display Size', 'Processor', 'Storage'],
            isActive: true,
            isVisible: true
        });
        console.log('✅ Created new child category Laptop with requiredVendorFields:', newCat.requiredVendorFields);
    }

    console.log('\n=== Step 2: Testing Category Fields Lookup API Query ===');
    const catDoc = await Category.findOne({
        $or: [
            { subSubcategory: new RegExp('^Laptop$', 'i') },
            { subcategory: new RegExp('^Laptop$', 'i') },
            { name: new RegExp('^Laptop$', 'i') }
        ]
    }).lean();

    console.log('API Lookup Result:');
    console.log('Category:', catDoc?.subSubcategory || catDoc?.subcategory || catDoc?.name);
    console.log('Required Vendor Fields:', catDoc?.requiredVendorFields);

    console.log('\n=== Step 3: Testing Product Specifications Persistence ===');
    const Product = require('./models/Product');
    const testProduct = await Product.create({
        name: 'Dell XPS 15 Flagship Laptop',
        category: 'Computers',
        subcategory: 'Laptop',
        price: 124999,
        description: 'High performance laptop for power users.',
        specifications: {
            RAM: '16 GB',
            'Display Size': '15.6 inch',
            Processor: 'Intel Core i7',
            Storage: '512 GB SSD'
        },
        isActive: true,
        isAvailable: true
    });

    console.log('Saved Product ID:', testProduct._id);
    console.log('Saved Product Specifications:', testProduct.specifications);

    // Clean up test product
    await Product.deleteOne({ _id: testProduct._id });
    console.log('✅ Cleaned up test product.');

    await mongoose.disconnect();
}

testDynamicFieldsFlow().catch(console.error);
