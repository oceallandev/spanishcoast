/* ── Social Media Campaigns (admin-campaigns.js) ─────────────────── */
'use strict';
(function () {

    /* ── Campaign data ──────────────────────────────────────────────── */
    const CAMPAIGNS = [
        /* ── INSTAGRAM ─── Properties ─────────────────────────────────── */
        {
            id: 'ig-prop-1', platform: 'instagram', category: 'properties',
            title: '🏡 New Listing Alert',
            caption: '✨ Just listed on the Costa Blanca South!\n\nThis stunning [type] in [town] features:\n🛏️ [X] bedrooms · 🛁 [X] bathrooms\n📐 [X]m² built · ☀️ South-facing terrace\n💰 Asking €[price]\n\nDM us "INFO" or tap the link in bio for the full brochure 📄\n\n#SpanishCoastProperties #CostaBlanca #SpainProperty',
            hashtags: '#SpanishCoastProperties #CostaBlanca #CostaBlancaSouth #PropertyForSale #SpainRealEstate #MediterraneanLiving #DreamHome #ExpatSpain #Torrevieja #Orihuela #Alicante #PropertyInvestment',
            bestTime: 'Tue/Wed 11:00–13:00 CET', emoji: '🏡'
        },
        {
            id: 'ig-prop-2', platform: 'instagram', category: 'properties',
            title: '🔥 Price Drop Spotlight',
            caption: '🚨 PRICE REDUCED! Was €[old] → Now €[new]\n\nThis [type] in [town] just got more affordable.\n\n🏊 Community pool\n🌅 Sea views\n🅿️ Private parking\n📍 Walking distance to the beach\n\nThis won\'t last — DM "DEAL" for details!\n\n#PriceReduced #PropertyDeal #CostaBlanca',
            hashtags: '#PriceReduced #BargainProperty #CostaBlanca #SpanishProperty #PropertyDeal #SpainHomes #Torrevieja #Guardamar #MediterraneanDream #InvestInSpain',
            bestTime: 'Thu 12:00–14:00 CET', emoji: '🔥'
        },
        {
            id: 'ig-prop-3', platform: 'instagram', category: 'properties',
            title: '🎬 Virtual Tour Invite',
            caption: '🎥 Take a virtual tour from your sofa!\n\nSwipe ➡️ through this beautiful [type] in [town].\n\nOr watch the full video reel — link in bio 🔗\n\nWant the brochure? Comment "BROCHURE" below 👇\n\n#VirtualTour #PropertyTour #CostaBlanca',
            hashtags: '#VirtualTour #PropertyVideo #360Tour #CostaBlanca #SpainProperty #HomeForSale #OpenHouse #RealEstateReel #SpanishCoastProperties',
            bestTime: 'Wed/Fri 10:00–12:00 CET', emoji: '🎬'
        },
        {
            id: 'ig-prop-4', platform: 'instagram', category: 'properties',
            title: '🏆 Hot Picks of the Week',
            caption: '🔝 THIS WEEK\'S TOP 5 PICKS 🔝\n\nOur hand-picked selection of the best properties this week on the Costa Blanca South:\n\n1️⃣ €[price] — [type] in [town]\n2️⃣ €[price] — [type] in [town]\n3️⃣ €[price] — [type] in [town]\n4️⃣ €[price] — [type] in [town]\n5️⃣ €[price] — [type] in [town]\n\nWhich one catches your eye? Tell us in the comments! 👇\n\n#WeeklyPicks #CostaBlanca #TopProperties',
            hashtags: '#WeeklyPicks #TopProperties #CostaBlanca #SpainRealEstate #PropertySelection #BestDeals #SpanishCoastProperties #MediterraneanHomes',
            bestTime: 'Mon 10:00–11:00 CET', emoji: '🏆'
        },

        /* ── INSTAGRAM ─── Lifestyle ──────────────────────────────────── */
        {
            id: 'ig-life-1', platform: 'instagram', category: 'lifestyle',
            title: '🌅 Costa Blanca Living',
            caption: '☀️ 320 days of sunshine a year.\n🌊 Crystal-clear Mediterranean waters.\n🍷 World-class gastronomy.\n🏡 Your dream home is waiting.\n\nThis is the Costa Blanca South lifestyle ✨\n\nReady to make the move? Let\'s talk 💬\n\n#CostaBlancaLife #LivingInSpain #ExpatLife',
            hashtags: '#CostaBlancaLife #LivingInSpain #ExpatLife #SunshineCoast #MediterraneanLifestyle #SpainDreams #MovingToSpain #Alicante #Torrevieja #SpanishCoast',
            bestTime: 'Sat/Sun 09:00–11:00 CET', emoji: '🌅'
        },
        {
            id: 'ig-life-2', platform: 'instagram', category: 'lifestyle',
            title: '🍽️ Local Markets & Food',
            caption: '🛒 Saturday morning at the local market in [town]...\n\nFresh fish 🐟 · Seasonal fruit 🍊 · Artisan cheese 🧀 · Local wine 🍷\n\nOne of the best things about living here? The food scene is incredible — and affordable!\n\nWhat would you pick up first? 🛍️\n\n#SpanishMarkets #LocalFood #CostaBlanca',
            hashtags: '#SpanishMarkets #MercadoLocal #FoodieSpain #CostaBlancaFood #MediterraneanDiet #FreshProduce #ExpatFood #SpanishCuisine #LocalLife',
            bestTime: 'Sat 10:00–12:00 CET', emoji: '🍽️'
        },
        {
            id: 'ig-life-3', platform: 'instagram', category: 'lifestyle',
            title: '🏖️ Beach Day Vibes',
            caption: '📍 [Beach name], Costa Blanca South\n\nBlue flag beaches. Boardwalk cafés. Warm sea until November.\n\nThis could be your daily commute 😉\n\nExplore properties near the coast → link in bio\n\n#BeachLife #CostaBlanca #SpainBeaches',
            hashtags: '#BeachLife #CostaBlanca #SpainBeaches #BlueFlagBeach #Torrevieja #Guardamar #SantaPola #MediterraneanSea #CoastalLiving #BeachHouse',
            bestTime: 'Wed/Sun 11:00–13:00 CET', emoji: '🏖️'
        },

        /* ── INSTAGRAM ─── Seasonal ──────────────────────────────────── */
        {
            id: 'ig-season-1', platform: 'instagram', category: 'seasonal',
            title: '☀️ Summer House-Hunting',
            caption: '🌴 Planning a summer visit to the Costa Blanca?\n\nCombine your holiday with property viewings!\n\n✅ Free viewing service\n✅ Curated shortlist before you arrive\n✅ Airport pickup available\n✅ No obligation\n\nDM us your dates and budget to get started 🏡\n\n#SummerInSpain #HouseHunting #CostaBlanca',
            hashtags: '#SummerInSpain #HouseHunting #PropertyViewings #CostaBlanca #ViewingTrip #FreeViewings #SpainProperty #BuyInSpain #SummerHoliday',
            bestTime: 'Tue 11:00–13:00 CET (May–Jul)', emoji: '☀️'
        },
        {
            id: 'ig-season-2', platform: 'instagram', category: 'seasonal',
            title: '❄️ Escape the Winter',
            caption: '🥶 -5°C back home?\n☀️ 18°C on the Costa Blanca.\n\nWinter sun apartments from €89,000.\nPerfect for snowbirds and remote workers.\n\n🔗 Browse now — link in bio\n\n#WinterSun #EscapeTheCold #CostaBlanca',
            hashtags: '#WinterSun #EscapeTheCold #Snowbird #WinterInSpain #CostaBlanca #RemoteWork #DigitalNomad #SunnySpain #WinterEscape #AffordableLiving',
            bestTime: 'Mon/Wed 12:00–14:00 CET (Nov–Feb)', emoji: '❄️'
        },

        /* ── INSTAGRAM ─── Engagement ─────────────────────────────────── */
        {
            id: 'ig-eng-1', platform: 'instagram', category: 'engagement',
            title: '📊 Poll: Sea View or Pool?',
            caption: '🏠 If you could only choose ONE, which would it be?\n\n🌊 A — Sea views from your terrace\n🏊 B — Private pool in your garden\n\nDrop A or B in the comments! 👇\n(Use our Stories poll too!)\n\n#PropertyPoll #CostaBlanca #DreamHome',
            hashtags: '#PropertyPoll #AorB #DreamHome #CostaBlanca #PropertyPreferences #RealEstatePolls #HomeGoals #SpanishProperty',
            bestTime: 'Fri 11:00–13:00 CET', emoji: '📊'
        },
        {
            id: 'ig-eng-2', platform: 'instagram', category: 'engagement',
            title: '💡 Did You Know?',
            caption: '💡 DID YOU KNOW?\n\nForeigners can get a Spanish mortgage at up to 70% LTV with rates from 2.5%!\n\n🏦 Most Spanish banks offer 20–25 year terms\n📋 You\'ll need: NIE, proof of income, bank statements\n💰 Budget an extra 10-12% for taxes & fees\n\nWant a free buying guide? Comment "GUIDE" 👇\n\n#BuyingInSpain #SpanishMortgage #PropertyTips',
            hashtags: '#BuyingInSpain #SpanishMortgage #PropertyTips #NIE #SpainProperty #ExpatMortgage #InvestInSpain #CostaBlanca #RealEstateTips',
            bestTime: 'Tue/Thu 10:00–12:00 CET', emoji: '💡'
        },
        {
            id: 'ig-eng-3', platform: 'instagram', category: 'engagement',
            title: '🎉 Client Success Story',
            caption: '🏡 SOLD! Congratulations to [client name] on their beautiful new [type] in [town]!\n\nFrom first enquiry to handover in just [X] weeks ⚡\n\n"[Testimonial quote]"\n\nWant the same result? Let us help you find yours 💛\n\n#Sold #HappyClients #CostaBlanca',
            hashtags: '#Sold #JustSold #HappyClients #ClientTestimonial #CostaBlanca #NewHome #DreamHomeBought #SpanishCoastProperties #RealEstateSuccess',
            bestTime: 'Wed/Fri 14:00–16:00 CET', emoji: '🎉'
        },

        /* ── FACEBOOK ─── Properties ──────────────────────────────────── */
        {
            id: 'fb-prop-1', platform: 'facebook', category: 'properties',
            title: '🏠 New Property Listing',
            caption: '🏠 NEW ON THE MARKET\n\n📍 [Town], Costa Blanca South\n🛏️ [X] bed · 🛁 [X] bath · 📐 [X]m²\n💰 €[price]\n\n✅ Community pool & gardens\n✅ Close to amenities\n✅ Ready to move in\n\n👉 Full details & photos: [link]\n📱 WhatsApp: +34 624 867 866\n\nShare with someone who\'d love this! 💛',
            hashtags: '#CostaBlanca #SpainProperty #NewListing #PropertyForSale #SpanishCoastProperties',
            bestTime: 'Tue–Thu 13:00–15:00 CET', emoji: '🏠'
        },
        {
            id: 'fb-prop-2', platform: 'facebook', category: 'properties',
            title: '📋 Buyer\'s Checklist Post',
            caption: '📋 BUYING IN SPAIN? Here\'s your essential checklist:\n\n✅ Get your NIE number\n✅ Open a Spanish bank account\n✅ Set your realistic budget (+12% fees)\n✅ Choose your area & priorities\n✅ Hire an independent lawyer\n✅ Book a viewing trip\n✅ Get a mortgage pre-approval\n✅ Make your offer\n\nWant our free PDF buying guide? Drop a 📋 in the comments!\n\n👉 Or contact us: info@spanishcoastproperties.com',
            hashtags: '#BuyingInSpain #PropertyChecklist #CostaBlanca #ExpatGuide #SpainProperty #RealEstateTips',
            bestTime: 'Wed 10:00–12:00 CET', emoji: '📋'
        },

        /* ── FACEBOOK ─── Lifestyle ───────────────────────────────────── */
        {
            id: 'fb-life-1', platform: 'facebook', category: 'lifestyle',
            title: '🌍 Expat Community Spotlight',
            caption: '🌍 THINKING OF MOVING TO SPAIN?\n\nThe Costa Blanca South has one of the largest international communities in Europe!\n\n🇬🇧 British · 🇳🇴 Norwegian · 🇸🇪 Swedish · 🇩🇪 German · 🇳🇱 Dutch · 🇧🇪 Belgian · 🇮🇪 Irish\n\nHere\'s what you\'ll find:\n👥 Active expat groups & social clubs\n🏥 Private healthcare from €60/month\n🏫 International schools\n🚌 Excellent transport links\n✈️ Alicante airport 30 min away\n\nJoin thousands who already made the move 🌞\n\n👉 Browse properties: [link]',
            hashtags: '#ExpatSpain #CostaBlanca #MovingToSpain #ExpatCommunity #InternationalLiving #SpainLife',
            bestTime: 'Sun 10:00–12:00 CET', emoji: '🌍'
        },

        /* ── FACEBOOK ─── Engagement ──────────────────────────────────── */
        {
            id: 'fb-eng-1', platform: 'facebook', category: 'engagement',
            title: '❓ Q&A: Ask Us Anything',
            caption: '🙋 ASK US ANYTHING — Live Q&A!\n\nGot questions about buying property in Spain?\n\nDrop your question in the comments below and our team will answer every single one! 💬\n\nCommon questions we get:\n❓ How much are the buying costs?\n❓ Can I get a mortgage as a non-resident?\n❓ What\'s the NIE and how do I get one?\n❓ How long does the buying process take?\n❓ Should I buy resale or new build?\n\n👇 Your turn — ask away!',
            hashtags: '#AskMeAnything #PropertyQA #BuyingInSpain #CostaBlanca #RealEstateHelp #SpainProperty',
            bestTime: 'Fri 14:00–16:00 CET', emoji: '❓'
        },

        /* ── TIKTOK ─── Properties ────────────────────────────────────── */
        {
            id: 'tt-prop-1', platform: 'tiktok', category: 'properties',
            title: '🎵 Property Reel Tour',
            caption: 'POV: You just found your dream home in Spain 🇪🇸✨\n\n📍 [Town], Costa Blanca\n💰 €[price]\n🛏️ [X] beds · 🏊 Pool · ☀️ Sea views\n\nLink in bio for the full listing 🏡\n\n#SpainProperty #CostaBlanca #DreamHome #PropertyTour #SpanishVilla',
            hashtags: '#SpainProperty #CostaBlanca #DreamHome #PropertyTour #SpanishVilla #HouseHunting #RealEstateTikTok #ExpatLife #SpainTravel #MovingToSpain #MillionDollarListing',
            bestTime: 'Tue/Thu/Sat 19:00–21:00 CET', emoji: '🎵'
        },
        {
            id: 'tt-prop-2', platform: 'tiktok', category: 'properties',
            title: '😱 Cheap vs Luxury',
            caption: '€89K vs €890K — which Spanish property would YOU pick? 🤯\n\n💰 Budget: Apartment, 2 bed, community pool\n💎 Luxury: Villa, 5 bed, infinity pool, sea views\n\nBoth on the Costa Blanca South!\nComment BUDGET or LUXURY 👇\n\n#CheapVsExpensive #PropertyCompare #SpainHomes',
            hashtags: '#CheapVsExpensive #PropertyCompare #SpainHomes #RealEstate #HouseHunting #LuxuryVsAffordable #CostaBlanca #PropertyTikTok #BudgetHome #DreamVilla',
            bestTime: 'Wed/Fri 18:00–20:00 CET', emoji: '😱'
        },

        /* ── TIKTOK ─── Lifestyle ─────────────────────────────────────── */
        {
            id: 'tt-life-1', platform: 'tiktok', category: 'lifestyle',
            title: '🌊 Day in the Life',
            caption: 'A day in my life living on the Costa Blanca ☀️🇪🇸\n\n☕ Morning coffee on the terrace\n🏖️ Beach walk\n🍽️ €10 menu del día\n🌅 Sunset from the rooftop\n\nThis could be your everyday ✨\n\n#DayInMyLife #SpainLife #CostaBlanca #ExpatDiaries',
            hashtags: '#DayInMyLife #SpainLife #CostaBlanca #ExpatDiaries #LivingAbroad #MovingToSpain #SpanishLifestyle #BeachLife #SunnySpain #Expat',
            bestTime: 'Daily 18:00–20:00 CET', emoji: '🌊'
        },
        {
            id: 'tt-life-2', platform: 'tiktok', category: 'lifestyle',
            title: '💸 Cost of Living',
            caption: 'What €[X] gets you in Spain vs the UK 🇪🇸🇬🇧\n\n🏡 Rent: €500/mo vs £1,200/mo\n🛒 Groceries: €200/mo vs £400/mo\n🍺 Beer: €1.50 vs £5\n☀️ Sunshine: 320 days vs... 🤔\n\nStill thinking about it? 😏\n\n#CostOfLiving #SpainVsUK #MovingToSpain',
            hashtags: '#CostOfLiving #SpainVsUK #MovingToSpain #AffordableLiving #ExpatLife #CostaBlanca #CheaperAbroad #SpainExpat #LifeInSpain',
            bestTime: 'Mon/Wed 19:00–21:00 CET', emoji: '💸'
        },

        /* ── LINKEDIN ─── Properties ──────────────────────────────────── */
        {
            id: 'li-prop-1', platform: 'linkedin', category: 'properties',
            title: '📈 Investment Opportunity',
            caption: '📈 Spanish Property: A Smart Investment in 2026\n\nThe Costa Blanca South continues to offer exceptional value:\n\n• Average yields of 5–8% on holiday rentals\n• Property prices 40% below northern European equivalents\n• Year-round rental demand from 320+ sunshine days\n• New infrastructure projects boosting connectivity\n• Golden Visa programme for non-EU investors\n\nAt Spanish Coast Properties, we help investors identify high-yield opportunities with transparent data and local expertise.\n\n📊 Want our quarterly market report? Connect with me or visit spanishcoastproperties.com\n\n#PropertyInvestment #SpainRealEstate #CostaBlanca #InvestInSpain #RealEstateInvesting',
            hashtags: '#PropertyInvestment #SpainRealEstate #CostaBlanca #InvestInSpain #RealEstateInvesting #PassiveIncome #HolidayRentals #PropertyMarket',
            bestTime: 'Tue–Thu 08:00–10:00 CET', emoji: '📈'
        },
        {
            id: 'li-prop-2', platform: 'linkedin', category: 'properties',
            title: '🤝 Partner With Us',
            caption: '🤝 Calling All Real Estate Professionals\n\nSpanish Coast Properties is expanding our partner network on the Costa Blanca South.\n\nOur white-label tools allow you to:\n✅ Brand property brochures with your agency logo\n✅ Generate video reels for social sharing\n✅ Access our full MLS inventory\n✅ Earn referral commissions (10%)\n\nWhether you\'re a local agent, international broker, or relocation specialist — let\'s collaborate.\n\n👉 DM me or visit our Collaborate page to learn more.\n\n#RealEstatePartners #AgencyNetwork #CostaBlanca #Collaboration',
            hashtags: '#RealEstatePartners #AgencyNetwork #CostaBlanca #Collaboration #WhiteLabel #RealEstateTools #PropertyProfessionals',
            bestTime: 'Wed 09:00–11:00 CET', emoji: '🤝'
        },

        /* ── LINKEDIN ─── Businesses ──────────────────────────────────── */
        {
            id: 'li-biz-1', platform: 'linkedin', category: 'businesses',
            title: '🏪 Business Opportunity',
            caption: '🏪 Own a Business on Spain\'s Sunshine Coast\n\nFrom established restaurants to thriving rental management companies, the Costa Blanca South offers serious business potential.\n\nCurrent opportunities include:\n🍽️ Restaurants & bars (from €45,000)\n🏠 Property management firms\n🛍️ Retail & e-commerce operations\n🏋️ Fitness & wellness centres\n\nWe provide full support: legal advice, documentation, licensing, and contracts.\n\n📩 Enquire: info@spanishcoastproperties.com\n\n#BusinessForSale #SpainBusiness #CostaBlanca #Entrepreneurship',
            hashtags: '#BusinessForSale #SpainBusiness #CostaBlanca #Entrepreneurship #BuyABusiness #SpanishBusiness #Opportunity #SME',
            bestTime: 'Tue/Thu 08:00–10:00 CET', emoji: '🏪'
        },

        /* ── X (TWITTER) ─── Properties ───────────────────────────────── */
        {
            id: 'x-prop-1', platform: 'x', category: 'properties',
            title: '🆕 Quick Listing Tweet',
            caption: '🆕 Just listed: [type] in [town], Costa Blanca\n\n🛏️ [X] bed · 💰 €[price]\n☀️ South-facing · 🏊 Pool\n\nFull details → [link]\n\n#CostaBlanca #SpainProperty',
            hashtags: '#CostaBlanca #SpainProperty #NewListing #PropertyForSale #RealEstate',
            bestTime: 'Mon–Fri 12:00–13:00 CET', emoji: '🆕'
        },
        {
            id: 'x-prop-2', platform: 'x', category: 'properties',
            title: '📊 Market Stats Thread',
            caption: '📊 THREAD: Costa Blanca Property Market Update Q[X] 2026\n\n1/ Average prices up [X]% year-on-year\n2/ Foreign buyers represent [X]% of transactions\n3/ British, Scandinavian and Benelux buyers dominate\n4/ New-build demand up [X]%\n5/ Rental yields averaging [X]%\n\nFull report → [link]\n\n#PropertyMarket #SpainRealEstate',
            hashtags: '#PropertyMarket #SpainRealEstate #MarketUpdate #CostaBlanca #InvestInSpain #RealEstateData',
            bestTime: 'Tue 09:00–10:00 CET', emoji: '📊'
        },

        /* ── X (TWITTER) ─── Engagement ───────────────────────────────── */
        {
            id: 'x-eng-1', platform: 'x', category: 'engagement',
            title: '🧠 Myth Buster',
            caption: '🧠 MYTH: "You need to be a resident to buy property in Spain"\n\n❌ FALSE! Anyone can buy property in Spain — EU or non-EU.\n\nYou just need:\n✅ NIE number\n✅ Spanish bank account\n✅ A good lawyer\n\nWe guide you through every step 🤝\n\n#SpainProperty #MythBusted',
            hashtags: '#SpainProperty #MythBusted #BuyingInSpain #RealEstateFacts #CostaBlanca #ExpatTips #PropertyMyths',
            bestTime: 'Wed/Fri 11:00–12:00 CET', emoji: '🧠'
        },

        /* ── FACEBOOK ─── Seasonal ────────────────────────────────────── */
        {
            id: 'fb-season-1', platform: 'facebook', category: 'seasonal',
            title: '🎄 Holiday Rental Promo',
            caption: '🎄 CHRISTMAS IN THE SUN ☀️\n\nForget the grey skies — spend the holidays on the Costa Blanca!\n\n🏡 Holiday apartments from €350/week\n🌡️ Average December temp: 16°C\n🎅 Traditional Spanish Christmas markets\n🍾 New Year\'s Eve on the beach!\n\nLimited availability for Dec 20 – Jan 5.\n\n📩 Book now: info@spanishcoastproperties.com\n📱 WhatsApp: +34 624 867 866',
            hashtags: '#ChristmasInSpain #HolidayRental #CostaBlanca #WinterSun #ChristmasHoliday #SpainTravel #WinterEscape',
            bestTime: 'Oct–Nov, daily 10:00–14:00 CET', emoji: '🎄'
        },
        {
            id: 'fb-season-2', platform: 'facebook', category: 'seasonal',
            title: '🌸 Spring New Builds',
            caption: '🌸 SPRING 2026 — New Build Season!\n\nBrand new developments now launching on the Costa Blanca South:\n\n🏗️ Modern apartments from €159,000\n🏗️ Luxury villas from €325,000\n🏗️ Penthouses with rooftop solarium\n\n✅ 10-year structural guarantee\n✅ Energy rating A\n✅ Completion Q3–Q4 2026\n\nReserve with just €6,000 deposit.\n\n👉 View all new builds: [link]',
            hashtags: '#NewBuild #OffPlan #CostaBlanca #NewDevelopment #ModernLiving #SpainNewBuild #PropertyLaunch',
            bestTime: 'Feb–Apr, Tue/Thu 12:00–14:00 CET', emoji: '🌸'
        },

        /* ── TIKTOK ─── Engagement ────────────────────────────────────── */
        {
            id: 'tt-eng-1', platform: 'tiktok', category: 'engagement',
            title: '🏠 Guess the Price',
            caption: 'Can you guess how much this house costs? 🤔💰\n\n📍 [Town], Costa Blanca South\n🛏️ [X] bedrooms\n🏊 Pool\n🌅 Views\n\nDrop your guess in the comments! Closest wins a shoutout 🎉\n\nAnswer in the next video 👀\n\n#GuessThePrice #SpainProperty #PropertyGame',
            hashtags: '#GuessThePrice #SpainProperty #PropertyGame #HowMuch #RealEstateTikTok #CostaBlanca #HouseHunting #PropertyChallenge',
            bestTime: 'Fri/Sat 19:00–21:00 CET', emoji: '🏠'
        },
    ];

    /* ── Platform config ────────────────────────────────────────────── */
    const PLATFORMS = {
        instagram: { label: 'Instagram', icon: '📸', color: '#E1306C' },
        facebook: { label: 'Facebook', icon: '👤', color: '#1877F2' },
        tiktok: { label: 'TikTok', icon: '🎵', color: '#000000' },
        linkedin: { label: 'LinkedIn', icon: '💼', color: '#0A66C2' },
        x: { label: 'X', icon: '𝕏', color: '#14171A' },
    };

    const CATEGORIES = {
        properties: { label: 'Properties', icon: '🏡' },
        lifestyle: { label: 'Lifestyle', icon: '🌅' },
        businesses: { label: 'Businesses', icon: '🏪' },
        seasonal: { label: 'Seasonal', icon: '🗓️' },
        engagement: { label: 'Engagement', icon: '💬' },
    };

    /* ── DOM refs ───────────────────────────────────────────────────── */
    const grid = document.getElementById('campaign-grid');
    const filterPlatform = document.getElementById('filter-platform');
    const filterCategory = document.getElementById('filter-category');
    const searchInput = document.getElementById('campaign-search');
    const countEl = document.getElementById('campaign-count');

    if (!grid) return;

    /* ── Render ─────────────────────────────────────────────────────── */
    function render() {
        const pf = filterPlatform ? filterPlatform.value : 'all';
        const cf = filterCategory ? filterCategory.value : 'all';
        const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

        const filtered = CAMPAIGNS.filter(c => {
            if (pf !== 'all' && c.platform !== pf) return false;
            if (cf !== 'all' && c.category !== cf) return false;
            if (q && !c.title.toLowerCase().includes(q) && !c.caption.toLowerCase().includes(q) && !c.hashtags.toLowerCase().includes(q)) return false;
            return true;
        });

        if (countEl) countEl.textContent = filtered.length + ' campaign' + (filtered.length !== 1 ? 's' : '');

        grid.innerHTML = filtered.map(c => {
            const plat = PLATFORMS[c.platform] || {};
            const cat = CATEGORIES[c.category] || {};
            return `
        <div class="campaign-card" data-platform="${c.platform}">
          <div class="campaign-card-head">
            <span class="campaign-platform-badge" style="--badge-color:${plat.color}">${plat.icon} ${plat.label}</span>
            <span class="campaign-category-tag">${cat.icon} ${cat.label}</span>
          </div>
          <div class="campaign-card-title">${c.emoji} ${c.title.replace(/^.+?\s/, '')}</div>
          <pre class="campaign-caption">${escapeHtml(c.caption)}</pre>
          <div class="campaign-meta">
            <span class="campaign-time">⏰ Best: ${c.bestTime}</span>
          </div>
          <div class="campaign-actions">
            <button class="cta-button campaign-copy-btn" data-copy="caption" data-id="${c.id}" type="button">📋 Copy Caption</button>
            <button class="cta-button cta-button--outline campaign-copy-btn" data-copy="hashtags" data-id="${c.id}" type="button"># Copy Hashtags</button>
            <button class="cta-button cta-button--outline campaign-copy-btn" data-copy="all" data-id="${c.id}" type="button">📦 Copy All</button>
          </div>
        </div>`;
        }).join('');
    }

    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* ── Copy ────────────────────────────────────────────────────────── */
    grid.addEventListener('click', e => {
        const btn = e.target.closest('.campaign-copy-btn');
        if (!btn) return;
        const id = btn.dataset.id;
        const type = btn.dataset.copy;
        const c = CAMPAIGNS.find(x => x.id === id);
        if (!c) return;

        let text = '';
        if (type === 'caption') text = c.caption;
        if (type === 'hashtags') text = c.hashtags;
        if (type === 'all') text = c.caption + '\n\n' + c.hashtags;

        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard! ✅');
            btn.classList.add('campaign-copied');
            setTimeout(() => btn.classList.remove('campaign-copied'), 1200);
        }).catch(() => {
            showToast('Copy failed — try manually');
        });
    });

    /* ── Toast ──────────────────────────────────────────────────────── */
    function showToast(msg) {
        let toast = document.getElementById('campaign-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'campaign-toast';
            toast.className = 'campaign-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._tm);
        toast._tm = setTimeout(() => toast.classList.remove('show'), 2000);
    }

    /* ── Events ─────────────────────────────────────────────────────── */
    if (filterPlatform) filterPlatform.addEventListener('change', render);
    if (filterCategory) filterCategory.addEventListener('change', render);
    if (searchInput) {
        let debounce;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(render, 200);
        });
    }

    /* ── Init ───────────────────────────────────────────────────────── */
    render();

})();
