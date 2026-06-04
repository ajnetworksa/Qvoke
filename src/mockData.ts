import { Company, Customer, Product, Quotation, Invoice, User } from './types';

export const mockUsers: User[] = [
  {
    id: 'u-1',
    name: 'Administrator',
    email: 'admin@ajnetwork.sa',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
  },
  {
    id: 'u-2',
    name: 'Sarah Rahman (Accountant)',
    email: 'sarah.r@ajnetwork.sa',
    role: 'accountant',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80'
  },
  {
    id: 'u-3',
    name: 'Fahad Al-Malki (Sales Mgr)',
    email: 'fahad.m@ajnetwork.sa',
    role: 'sales_manager',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80'
  },
  {
    id: 'u-4',
    name: 'Alice Cooper (Salesperson)',
    email: 'alice.c@ajnetwork.sa',
    role: 'salesperson',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80'
  }
];

export const mockCompany: Company = {
  id: 'c-1',
  name: 'Qvoke',
  logo: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=120&h=120&q=80',
  address: {
    street: 'King Abdulaziz Road, Al Olaya',
    district: 'Al Olaya Dist.',
    city: 'Riyadh',
    postalCode: '12211',
    country: 'SA'
  },
  phone: '+966 11 456 7890',
  email: 'info@ajnetwork.sa',
  vatNumber: '310123456700003',
  crNumber: '1010456789',
  currency: 'SAR',
  defaultTax: 15,
  brandColor: '#01696f'
};

export const mockCustomers: Customer[] = [
  {
    id: 'cust-1',
    companyName: 'Ahmed Mohammed Al-Arfaj Housing Units Est.',
    contactPerson: 'Mr. Ahmed Al-Arfaj',
    email: 'ahmed@arfaj-housing.sa',
    phone: '0505936329',
    vatNumber: '300567891200003',
    billingAddress: {
      street: 'Al Olaya Dist.',
      district: 'Al Olaya',
      city: 'Al Khobar',
      postalCode: '31952',
      country: 'SA'
    },
    createdAt: new Date('2025-01-10T10:00:00Z')
  },
  {
    id: 'cust-2',
    companyName: 'Khalid Alshekmubarak Trading',
    contactPerson: 'Mr. Khalid Alshekmubarak',
    email: 'khalid@shekmubarak.sa',
    phone: '0532730304',
    vatNumber: '300891234500003',
    billingAddress: {
      street: 'Albusairah',
      district: 'Albusairah Dist.',
      city: 'Al Hufuf',
      postalCode: '36362',
      country: 'SA'
    },
    createdAt: new Date('2025-02-14T11:30:00Z')
  },
  {
    id: 'cust-3',
    companyName: 'Red Sea Global Hospitality',
    contactPerson: 'Eng. Basel Al-Harbi',
    email: 'b.harbi@redseaglobal.sa',
    phone: '0544558899',
    vatNumber: '302456789100003',
    billingAddress: {
      street: 'Prince Sultan Street',
      district: 'Al Rawdah',
      city: 'Jeddah',
      postalCode: '23431',
      country: 'SA'
    },
    createdAt: new Date('2025-03-20T09:15:00Z')
  }
];

export const mockProducts: Product[] = [
  {
    id: 'p-1',
    name: 'Hikvision 12MP Acusense Smart Hybrid Bullet Camera',
    description: 'كاميرا هيكفيجن أكيوسنس الذكية 12 ميجابكسل هجينة خفيفة رصاصة ثنائية الإضاءة\nHikvision 12MP Acusense Smart Hybrid Light Fixed Bullet Network Camera',
    type: 'product',
    unitPrice: 453.68,
    unit: 'pc',
    taxRate: 15,
    categoryId: 'cctv'
  },
  {
    id: 'p-2',
    name: 'Hikvision 32-Ch 1.5U K Series AcuSense 4K NVR',
    description: 'جهاز تسجيل شبكي هيكفيجن 32 قناة 4K دقة فائقة\nHikvision 32-Ch 1.5U K Series AcuSense 4K NVR, DS-7732NI-I4/16P',
    type: 'product',
    unitPrice: 3000.00,
    unit: 'pc',
    taxRate: 15,
    categoryId: 'cctv'
  },
  {
    id: 'p-3',
    name: '10 TB Surveillance Hard Disk - WD | Toshiba',
    description: 'قرص صلب سعة 10 تيرابايت مخصص لأنظمة المراقبة\n10 TB Surveillance Hard Disk Drive, optimized for 24/7 recording',
    type: 'product',
    unitPrice: 1425.00,
    unit: 'pc',
    taxRate: 15,
    categoryId: 'storage'
  },
  {
    id: 'p-4',
    name: 'Huawei Outdoor AP, Wi-Fi 7 - AP771',
    description: 'نطاق التغطية الأمثل 130 متراً هواوي واي فاي 7 خارجي\nHuawei Outdoor AP, Wi-Fi 7 - AP771, 130m Optimal Coverage Range',
    type: 'product',
    unitPrice: 993.68,
    unit: 'pc',
    taxRate: 15,
    categoryId: 'networking'
  },
  {
    id: 'p-5',
    name: 'Huawei Wall Plate AP Wi-Fi 6 - AP160',
    description: 'هواوي لوحة الحائط AP Wi-Fi 6 - AP160 للغرف الفندقية والمكاتب\nHuawei Wall Plate AP Wi-Fi 6 - AP160',
    type: 'product',
    unitPrice: 310.00,
    unit: 'pc',
    taxRate: 15,
    categoryId: 'networking'
  },
  {
    id: 'p-6',
    name: 'Yeastar P550 IP PBX Phone System',
    description: 'بدالة سنترال ييستار P550 نظام الاتصال الذكي للمؤسسات\nYeastar P550 IP PBX Phone System, supports up to 50 users',
    type: 'product',
    unitPrice: 2113.13,
    unit: 'pc',
    taxRate: 15,
    categoryId: 'telephony'
  },
  {
    id: 'p-7',
    name: 'Fanvil V62G-WH Business IP Phone',
    description: 'شاشة ملونة 2.8 بوصة هاتف هانفيل Fanvil V62G-WH جيجابت آي بي\nFanvil V62G-WH Business IP Phone, 2.8 Color Screen, Giga Ports',
    type: 'product',
    unitPrice: 205.20,
    unit: 'pc',
    taxRate: 15,
    categoryId: 'telephony'
  },
  {
    id: 'p-8',
    name: 'Pyle 6.5-Inch In-Wall/In-Ceiling Midbass Speakers (Pair)',
    description: 'بايل 6.5 بوصة مكبرات صوت متوسطة المدى داخل الحائط/السقف\nPyle 6.5-Inch In-Wall/In-Ceiling Midbass Speakers (Pair)',
    type: 'product',
    unitPrice: 275.00,
    unit: 'set',
    taxRate: 15,
    categoryId: 'audio'
  },
  {
    id: 'p-9',
    name: 'Pyle 2000 Watts 2-CH Bluetooth Amplifier',
    description: 'مضخم صوت بلوتوث بايل 2000 واط قناتين مع مروحة تبريد\nPyle 2000 Watts 2-CH Bluetooth Amplifier w/ Cooling Fan',
    type: 'product',
    unitPrice: 912.68,
    unit: 'pc',
    taxRate: 15,
    categoryId: 'audio'
  },
  {
    id: 'p-10',
    name: 'Network Cable Cat6 UTP 305M Roll',
    description: 'لفة سلك شبكة كات 6 بطول 305 متر\nHigh Quality Cat6 UTP copper ethernet cable 305m roll',
    type: 'product',
    unitPrice: 380.00,
    unit: 'roll',
    taxRate: 15,
    categoryId: 'networking'
  }
];

export const mockQuotations: Quotation[] = [
  {
    id: 'qt-1',
    number: 'AJ-57022',
    customerId: 'cust-1',
    date: new Date('2026-05-05T12:00:00Z'),
    validUntil: new Date('2026-05-07T12:00:00Z'),
    status: 'draft',
    salespersonId: 'u-4', // Alice
    currency: 'SAR',
    lineItems: [
      {
        id: 'li-1',
        type: 'item',
        productId: 'p-1',
        description: 'Hikvision 12MP Acusense Smart Hybrid Bullet Camera\nكاميرا هيكفيجن أكيوسنس الذكية 12 ميجابكسل هجينة خفيفة رصاصة ثنائية الإضاءة',
        quantity: 22,
        unit: 'pc',
        unitPrice: 453.68,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 9980.96
      },
      {
        id: 'li-2',
        type: 'item',
        productId: 'p-2',
        description: 'Hikvision 32-Ch 1.5U K Series AcuSense 4K NVR\nجهاز تسجيل شبكي هيكفيجن 32 قناة 4K دقة فائقة',
        quantity: 1,
        unit: 'pc',
        unitPrice: 3000.00,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 3000.00
      },
      {
        id: 'li-3',
        type: 'section',
        description: 'Cables & Networking Infrastructure',
        quantity: 0,
        unit: 'pc',
        unitPrice: 0,
        discountPercent: 0,
        taxPercent: 0,
        subtotal: 0
      },
      {
        id: 'li-4',
        type: 'item',
        productId: 'p-4',
        description: 'Huawei Outdoor AP, Wi-Fi 7 - AP771\nنطاق التغطية الأمثل 130 متراً هواوي واي فاي 7 خارجي',
        quantity: 2,
        unit: 'pc',
        unitPrice: 993.68,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 1987.36
      },
      {
        id: 'li-5',
        type: 'note',
        description: 'All installation works include a 1-year onsite warranty.',
        quantity: 0,
        unit: 'pc',
        unitPrice: 0,
        discountPercent: 0,
        taxPercent: 0,
        subtotal: 0
      }
    ],
    notes: 'Any additional work/device will be considered Change Order.\nسيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير.',
    terms: 'Payment: 50% Downpayment | Balance Upon Delivery\nمقدم 50% | الرصيد عند التسليم\nWarranty: 2 YEARS limited warranty and/or supplier\'s recommendation\nضمان محدود لمدة عامين وأو توصية المورد\nManpower: 4 Technicians, 1 Supervisor\nفنيين 1 مشرف 4',
    subtotal: 14968.32,
    discountTotal: 0,
    taxTotal: 2245.25,
    total: 17213.57,
    createdAt: new Date('2026-05-05T12:00:00Z'),
    updatedAt: new Date('2026-05-05T12:00:00Z')
  },
  {
    id: 'qt-2',
    number: 'QT-2026-0002',
    customerId: 'cust-2',
    date: new Date('2026-05-24T09:00:00Z'),
    validUntil: new Date('2026-06-24T09:00:00Z'),
    status: 'sent',
    salespersonId: 'u-4', // Alice
    currency: 'SAR',
    lineItems: [
      {
        id: 'li-2-1',
        type: 'item',
        productId: 'p-7',
        description: 'Fanvil V62G-WH Business IP Phone\nشاشة ملونة 2.8 بوصة هاتف هانفيل Fanvil V62G-WH',
        quantity: 5,
        unit: 'pc',
        unitPrice: 205.20,
        discountPercent: 10, // 10% discount
        taxPercent: 15,
        subtotal: 923.40
      },
      {
        id: 'li-2-2',
        type: 'item',
        productId: 'p-6',
        description: 'Yeastar P550 IP PBX Phone System\nبدالة سنترال ييستار P550',
        quantity: 1,
        unit: 'pc',
        unitPrice: 2113.13,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 2113.13
      }
    ],
    notes: 'Configured and tested before delivery.',
    terms: 'Payment terms: Due on Receipt.',
    subtotal: 3036.53,
    discountTotal: 102.60,
    taxTotal: 440.09,
    total: 3374.02,
    createdAt: new Date('2026-05-24T09:00:00Z'),
    updatedAt: new Date('2026-05-24T09:00:00Z')
  },
  {
    id: 'qt-3',
    number: 'QT-2026-0003',
    customerId: 'cust-3',
    date: new Date('2026-05-10T14:00:00Z'),
    validUntil: new Date('2026-06-10T14:00:00Z'),
    status: 'confirmed',
    salespersonId: 'u-3', // Fahad (Sales Manager)
    currency: 'SAR',
    lineItems: [
      {
        id: 'li-3-1',
        type: 'item',
        productId: 'p-8',
        description: 'Pyle 6.5-Inch Speakers (Pair)',
        quantity: 10,
        unit: 'set',
        unitPrice: 275.00,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 2750.00
      },
      {
        id: 'li-3-2',
        type: 'item',
        productId: 'p-9',
        description: 'Pyle 2000 Watts 2-CH Bluetooth Amplifier',
        quantity: 3,
        unit: 'pc',
        unitPrice: 912.68,
        discountPercent: 5,
        taxPercent: 15,
        subtotal: 2601.14
      }
    ],
    notes: 'Special project pricing applied.',
    terms: '30 Days Net Payment.',
    subtotal: 5351.14,
    discountTotal: 136.90,
    taxTotal: 782.14,
    total: 5996.38,
    linkedInvoiceId: 'inv-3',
    createdAt: new Date('2026-05-10T14:00:00Z'),
    updatedAt: new Date('2026-05-12T10:00:00Z')
  },
  {
    id: 'qt-4',
    number: 'QT-2026-0004',
    customerId: 'cust-2',
    date: new Date('2026-04-01T08:00:00Z'),
    validUntil: new Date('2026-04-15T08:00:00Z'),
    status: 'expired',
    salespersonId: 'u-4',
    currency: 'USD',
    lineItems: [
      {
        id: 'li-4-1',
        type: 'item',
        productId: 'p-10',
        description: 'Network Cable Cat6 UTP 305M Roll',
        quantity: 15,
        unit: 'roll',
        unitPrice: 101.33,
        discountPercent: 0,
        taxPercent: 5,
        subtotal: 1519.95
      }
    ],
    subtotal: 1519.95,
    discountTotal: 0,
    taxTotal: 76.00,
    total: 1595.95,
    createdAt: new Date('2026-04-01T08:00:00Z'),
    updatedAt: new Date('2026-04-15T08:00:00Z')
  },
  {
    id: 'qt-5',
    number: 'QT-2026-0005',
    customerId: 'cust-3',
    date: new Date('2026-05-01T09:00:00Z'),
    validUntil: new Date('2026-05-15T09:00:00Z'),
    status: 'cancelled',
    salespersonId: 'u-4',
    currency: 'SAR',
    lineItems: [
      {
        id: 'li-5-1',
        type: 'item',
        productId: 'p-3',
        description: '10 TB Surveillance Hard Disk - WD | Toshiba',
        quantity: 8,
        unit: 'pc',
        unitPrice: 1425.00,
        discountPercent: 12,
        taxPercent: 15,
        subtotal: 10032.00
      }
    ],
    subtotal: 10032.00,
    discountTotal: 1368.00,
    taxTotal: 1504.80,
    total: 10168.80,
    createdAt: new Date('2026-05-01T09:00:00Z'),
    updatedAt: new Date('2026-05-04T11:00:00Z')
  }
];

export const mockInvoices: Invoice[] = [
  {
    id: 'inv-1',
    number: 'INV-2026-0001',
    customerId: 'cust-1',
    date: new Date('2026-05-06T10:00:00Z'),
    dueDate: new Date('2026-06-06T10:00:00Z'),
    status: 'draft',
    salespersonId: 'u-4',
    currency: 'SAR',
    paymentTerms: 'Net 30',
    lineItems: [
      {
        id: 'li-i1-1',
        type: 'item',
        productId: 'p-1',
        description: 'Hikvision 12MP Acusense Smart Hybrid Bullet Camera',
        quantity: 12,
        unit: 'pc',
        unitPrice: 453.68,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 5444.16
      },
      {
        id: 'li-i1-2',
        type: 'item',
        productId: 'p-3',
        description: '10 TB Surveillance Hard Disk - WD | Toshiba',
        quantity: 2,
        unit: 'pc',
        unitPrice: 1425.00,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 2850.00
      }
    ],
    notes: 'First batch invoice for the security installation project.',
    terms: 'Default T&C applies.',
    subtotal: 8294.16,
    discountTotal: 0,
    taxTotal: 1244.12,
    total: 9538.28,
    payments: [],
    amountPaid: 0,
    amountDue: 9538.28,
    createdAt: new Date('2026-05-06T10:00:00Z'),
    updatedAt: new Date('2026-05-06T10:00:00Z')
  },
  {
    id: 'inv-2',
    number: 'INV-2026-0002',
    customerId: 'cust-1',
    date: new Date('2026-05-02T10:00:00Z'),
    dueDate: new Date('2026-05-17T10:00:00Z'),
    status: 'paid',
    salespersonId: 'u-4',
    currency: 'SAR',
    paymentTerms: 'Net 15',
    lineItems: [
      {
        id: 'li-i2-1',
        type: 'item',
        productId: 'p-5',
        description: 'Huawei Wall Plate AP Wi-Fi 6 - AP160',
        quantity: 15,
        unit: 'pc',
        unitPrice: 310.00,
        discountPercent: 5,
        taxPercent: 15,
        subtotal: 4417.50
      }
    ],
    notes: 'Completed wireless access installation.',
    subtotal: 4417.50,
    discountTotal: 232.50,
    taxTotal: 662.63,
    total: 5080.13,
    payments: [
      {
        id: 'pay-1',
        date: new Date('2026-05-04T14:30:00Z'),
        amount: 5080.13,
        method: 'bank_transfer',
        reference: 'TR-99882211',
        note: 'Full settlement'
      }
    ],
    amountPaid: 5080.13,
    amountDue: 0,
    createdAt: new Date('2026-05-02T10:00:00Z'),
    updatedAt: new Date('2026-05-04T14:30:00Z')
  },
  {
    id: 'inv-3',
    number: 'INV-2026-0003',
    customerId: 'cust-3',
    date: new Date('2026-05-12T10:00:00Z'),
    dueDate: new Date('2026-06-12T10:00:00Z'),
    status: 'partial',
    salespersonId: 'u-3',
    currency: 'SAR',
    paymentTerms: 'Net 30',
    linkedQuoteId: 'qt-3',
    lineItems: [
      {
        id: 'li-i3-1',
        type: 'item',
        productId: 'p-8',
        description: 'Pyle 6.5-Inch Speakers (Pair)',
        quantity: 10,
        unit: 'set',
        unitPrice: 275.00,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 2750.00
      },
      {
        id: 'li-i3-2',
        type: 'item',
        productId: 'p-9',
        description: 'Pyle 2000 Watts 2-CH Bluetooth Amplifier',
        quantity: 3,
        unit: 'pc',
        unitPrice: 912.68,
        discountPercent: 5,
        taxPercent: 15,
        subtotal: 2601.14
      }
    ],
    subtotal: 5351.14,
    discountTotal: 136.90,
    taxTotal: 782.14,
    total: 5996.38,
    payments: [
      {
        id: 'pay-2',
        date: new Date('2026-05-13T09:00:00Z'),
        amount: 2500.00,
        method: 'cash',
        note: 'First installment payment'
      }
    ],
    amountPaid: 2500.00,
    amountDue: 3496.38,
    createdAt: new Date('2026-05-12T10:00:00Z'),
    updatedAt: new Date('2026-05-13T09:00:00Z')
  },
  {
    id: 'inv-4',
    number: 'INV-2026-0004',
    customerId: 'cust-2',
    date: new Date('2026-04-10T10:00:00Z'),
    dueDate: new Date('2026-05-10T10:00:00Z'),
    status: 'overdue',
    salespersonId: 'u-4',
    currency: 'SAR',
    paymentTerms: 'Net 30',
    lineItems: [
      {
        id: 'li-i4-1',
        type: 'item',
        productId: 'p-6',
        description: 'Yeastar P550 IP PBX Phone System',
        quantity: 1,
        unit: 'pc',
        unitPrice: 2113.13,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 2113.13
      },
      {
        id: 'li-i4-2',
        type: 'item',
        productId: 'p-7',
        description: 'Fanvil V62G-WH Business IP Phone',
        quantity: 10,
        unit: 'pc',
        unitPrice: 205.20,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 2052.00
      }
    ],
    notes: 'Please settle as soon as possible.',
    subtotal: 4165.13,
    discountTotal: 0,
    taxTotal: 624.77,
    total: 4789.90,
    payments: [],
    amountPaid: 0,
    amountDue: 4789.90,
    createdAt: new Date('2026-04-10T10:00:00Z'),
    updatedAt: new Date('2026-04-10T10:00:00Z')
  },
  {
    id: 'inv-5',
    number: 'INV-2026-0005',
    customerId: 'cust-2',
    date: new Date('2026-05-15T11:00:00Z'),
    dueDate: new Date('2026-05-15T11:00:00Z'),
    status: 'posted',
    salespersonId: 'u-4',
    currency: 'SAR',
    paymentTerms: 'Due on Receipt',
    lineItems: [
      {
        id: 'li-i5-1',
        type: 'item',
        productId: 'p-10',
        description: 'Network Cable Cat6 UTP 305M Roll',
        quantity: 2,
        unit: 'roll',
        unitPrice: 380.00,
        discountPercent: 0,
        taxPercent: 15,
        subtotal: 760.00
      }
    ],
    subtotal: 760.00,
    discountTotal: 0,
    taxTotal: 114.00,
    total: 874.00,
    payments: [],
    amountPaid: 0,
    amountDue: 874.00,
    createdAt: new Date('2026-05-15T11:00:00Z'),
    updatedAt: new Date('2026-05-15T11:00:00Z')
  }
];
