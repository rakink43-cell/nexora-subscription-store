-- ===========================================================================
-- NEXORA · 0007 — Seed content (idempotent)
-- Catalogue lives in the database, never hardcoded in the frontend.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, description, icon, accent, sort_order) values
  ('OTT Subscriptions', 'ott-subscriptions',
   'Netflix, Prime Video, Disney+, Hoichoi and more — premium streaming at local prices.',
   'Clapperboard', 'red', 1),
  ('AI Premium Tools', 'ai-premium-tools',
   'ChatGPT Plus, Claude Pro, Gemini Advanced, Perplexity and creative AI suites.',
   'BrainCircuit', 'blue', 2),
  ('Educational Subscriptions', 'educational-subscriptions',
   'Coursera, Udemy, Skillshare and language learning to level up your career.',
   'GraduationCap', 'blue', 3),
  ('Software & Productivity', 'software-productivity',
   'Microsoft 365, Canva Pro, Adobe, Notion and the tools that get work done.',
   'Layers', 'blue', 4),
  ('Gaming & Entertainment', 'gaming-entertainment',
   'PlayStation Plus, Xbox Game Pass, Spotify and everything fun.',
   'Gamepad2', 'red', 5),
  ('Design & Creative', 'design-creative',
   'Figma, Envato Elements, Midjourney and premium creative assets.',
   'Palette', 'blue', 6)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      accent = excluded.accent,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
insert into public.products (
  category_id, name, slug, brand, short_description, description, duration,
  original_price, discounted_price, delivery_info, delivery_time, availability,
  is_featured, badge, rating, rating_count, sales_count, sort_order
)
select
  c.id, v.name, v.slug, v.brand, v.short_description, v.description, v.duration,
  v.original_price, v.discounted_price,
  'Instant delivery after payment verification. Login details are sent to your email and customer dashboard.',
  v.delivery_time, v.availability, v.is_featured, v.badge, v.rating, v.rating_count, v.sales_count, v.sort_order
from (values
  -- OTT
  ('ott-subscriptions', 'Netflix Premium 4K', 'netflix-premium-4k', 'Netflix',
   'Private 4K Ultra HD profile with your own PIN — works on TV, phone and laptop.',
   'Enjoy Netflix in stunning 4K Ultra HD on a private profile inside a Premium plan. You get your own profile with a personal PIN, so nobody else can touch your watchlist or recommendations. Supports up to 4 simultaneous screens on the main plan and works on Smart TV, Android, iOS, Windows and Fire Stick. Shared Premium plan — profile is private to you for the full duration.',
   '1 Month', 650, 390, 'Within 10–30 minutes', 'in_stock', true, 'Best Seller', 4.9, 1284, 2140, 1),

  ('ott-subscriptions', 'Netflix Premium 4K — 3 Months', 'netflix-premium-4k-3-months', 'Netflix',
   'Three months of private 4K Netflix at the best per-month price.',
   'The best value way to keep Netflix Premium 4K for a full quarter. Private profile with PIN, 4K Ultra HD streaming, and stable service backed by our replacement guarantee. Save over 40% compared to paying monthly.',
   '3 Months', 1800, 1050, 'Within 10–30 minutes', 'in_stock', true, 'Save 42%', 4.8, 642, 980, 2),

  ('ott-subscriptions', 'Amazon Prime Video', 'amazon-prime-video', 'Prime Video',
   'Full Prime Video access with your own profile — watch on any device.',
   'Amazon Prime Video with a private profile on a premium account. Watch Originals, movies and live sports in Full HD on up to 3 devices. Includes your own watchlist and parental controls.',
   '1 Month', 450, 249, 'Within 10–30 minutes', 'in_stock', false, null, 4.8, 512, 1190, 3),

  ('ott-subscriptions', 'Disney+ Premium', 'disney-plus-premium', 'Disney+',
   'Marvel, Star Wars, Pixar and National Geographic in one place.',
   'Disney+ Premium with 4K HDR streaming on a private profile. Includes Marvel, Star Wars, Pixar, Disney classics and National Geographic. Perfect for families — add profiles for the kids.',
   '1 Month', 500, 279, 'Within 10–30 minutes', 'in_stock', true, 'Family Favourite', 4.7, 388, 860, 4),

  ('ott-subscriptions', 'Hoichoi Premium', 'hoichoi-premium', 'Hoichoi',
   'The biggest Bengali OTT library — original series, films and web shows.',
   'Hoichoi Premium gives you unlimited access to Bengali original series, films, and exclusive web content in Full HD. Works on Android, iOS, Smart TV and web with downloads for offline viewing.',
   '1 Month', 300, 169, 'Within 10–30 minutes', 'in_stock', false, null, 4.8, 274, 720, 5),

  ('ott-subscriptions', 'Zee5 Premium', 'zee5-premium', 'ZEE5',
   'Indian and Bengali entertainment, originals and live TV channels.',
   'ZEE5 Premium subscription with access to Originals, movies, and 100+ live TV channels. Private profile, Full HD streaming, supports 2 devices at a time.',
   '1 Month', 350, 189, 'Within 10–30 minutes', 'limited', false, null, 4.6, 156, 340, 6),

  ('ott-subscriptions', 'Chorki Premium', 'chorki-premium', 'Chorki',
   'Bangladeshi original series and films in Full HD.',
   'Chorki Premium with unlimited access to Bangladeshi original series, films, and exclusive content. Full HD streaming with offline downloads supported.',
   '1 Month', 250, 149, 'Within 10–30 minutes', 'in_stock', false, null, 4.7, 198, 410, 7),

  -- AI
  ('ai-premium-tools', 'ChatGPT Plus', 'chatgpt-plus', 'OpenAI',
   'GPT-5 class models, advanced reasoning and priority access — private account.',
   'A private ChatGPT Plus account with access to the latest frontier models, advanced reasoning, file and image analysis, custom GPTs, and priority access during peak hours. Includes your own login credentials so your chat history stays completely private.',
   '1 Month', 2900, 1290, 'Within 15–45 minutes', 'in_stock', true, 'Trending', 4.9, 1042, 1830, 1),

  ('ai-premium-tools', 'ChatGPT Plus — 3 Months', 'chatgpt-plus-3-months', 'OpenAI',
   'A full quarter of ChatGPT Plus on a private account at a lower monthly rate.',
   'Three months of private ChatGPT Plus access with priority support and free replacement if anything goes wrong. Best option if you use AI daily for work or study.',
   '3 Months', 8700, 3490, 'Within 15–45 minutes', 'in_stock', true, 'Save 60%', 4.8, 415, 640, 2),

  ('ai-premium-tools', 'Claude Pro', 'claude-pro', 'Anthropic',
   'Anthropic Claude Pro with extended thinking and 5x higher usage limits.',
   'Claude Pro on a private account with access to the most capable Claude models, extended thinking, larger context windows, projects and artifacts. Ideal for long-document analysis, coding and writing.',
   '1 Month', 2800, 1190, 'Within 15–45 minutes', 'in_stock', true, null, 4.9, 386, 520, 3),

  ('ai-premium-tools', 'Google Gemini Advanced', 'google-gemini-advanced', 'Google',
   'Gemini Advanced with 2TB Google One storage included.',
   'Google Gemini Advanced subscription with access to Google''s most capable AI models, deep integration with Docs, Sheets, Gmail and 2TB of Google One cloud storage on your own Google account.',
   '1 Month', 2400, 990, 'Within 15–45 minutes', 'in_stock', false, null, 4.7, 248, 430, 4),

  ('ai-premium-tools', 'Perplexity Pro', 'perplexity-pro', 'Perplexity',
   'AI answer engine with unlimited Pro searches and model selection.',
   'Perplexity Pro with unlimited Pro searches, access to leading frontier models, file upload analysis and focus modes for academic and financial research.',
   '1 Month', 2600, 890, 'Within 15–45 minutes', 'in_stock', false, null, 4.7, 176, 310, 5),

  ('ai-premium-tools', 'Midjourney Standard', 'midjourney-standard', 'Midjourney',
   '15 hours of fast GPU time plus unlimited relaxed image generation.',
   'Midjourney Standard plan on a shared account setup: 15 hours of fast generation per month plus unlimited relaxed mode for AI art and commercial concept work.',
   '1 Month', 3200, 1590, 'Within 1–3 hours', 'limited', false, null, 4.6, 129, 190, 6),

  ('ai-premium-tools', 'ElevenLabs Creator', 'elevenlabs-creator', 'ElevenLabs',
   'Studio-grade AI voice generation with 100k credits per month.',
   'ElevenLabs Creator plan with 100,000 credits per month, professional voice cloning, multi-language dubbing and commercial usage rights. Perfect for YouTube voiceovers and audiobooks.',
   '1 Month', 2900, 1390, 'Within 1–3 hours', 'in_stock', false, 'New', 4.8, 88, 140, 7),

  -- Education
  ('educational-subscriptions', 'Coursera Plus', 'coursera-plus', 'Coursera',
   'Unlimited access to 7,000+ courses with certificates from top universities.',
   'Coursera Plus gives unlimited access to 7,000+ courses, Professional Certificates and Specializations from Google, IBM, Stanford, Yale and more. Earn shareable certificates for every completed course.',
   '1 Month', 6500, 1290, 'Within 2–6 hours', 'in_stock', true, 'Career Boost', 4.8, 214, 380, 1),

  ('educational-subscriptions', 'Udemy Premium Courses Bundle', 'udemy-premium-bundle', 'Udemy',
   'Hand-picked best-selling courses across tech, design and business.',
   'Get access to a curated bundle of best-selling Udemy courses across programming, design, marketing and business. Lifetime access to the selected course library with downloadable resources.',
   '12 Months', 4200, 1490, 'Within 2–6 hours', 'in_stock', false, null, 4.6, 142, 260, 2),

  ('educational-subscriptions', 'Skillshare Premium', 'skillshare-premium', 'Skillshare',
   'Thousands of creative classes with offline viewing.',
   'Skillshare Premium with unlimited access to 35,000+ classes in illustration, design, photography, freelancing and business. Offline viewing on mobile included.',
   '3 Months', 3600, 890, 'Within 2–6 hours', 'in_stock', false, null, 4.6, 118, 210, 3),

  ('educational-subscriptions', 'Duolingo Super', 'duolingo-super', 'Duolingo',
   'No ads, unlimited hearts and personalised practice.',
   'Duolingo Super removes ads, gives unlimited hearts, and unlocks personalised practice and progress quizzes so you can learn languages faster without interruptions.',
   '12 Months', 2400, 790, 'Within 1–4 hours', 'in_stock', false, null, 4.7, 203, 340, 4),

  ('educational-subscriptions', 'LinkedIn Learning', 'linkedin-learning', 'LinkedIn',
   '16,000+ expert courses plus a LinkedIn Premium badge.',
   'LinkedIn Learning with 16,000+ expert-led courses and a LinkedIn Premium badge on your profile. Includes certificates you can add directly to your LinkedIn profile.',
   '1 Month', 3200, 890, 'Within 2–6 hours', 'limited', false, null, 4.5, 96, 150, 5),

  -- Software
  ('software-productivity', 'Microsoft 365 Family', 'microsoft-365-family', 'Microsoft',
   'Word, Excel, PowerPoint, Outlook + 1TB OneDrive — 12 months.',
   'Microsoft 365 Family subscription covering Word, Excel, PowerPoint, Outlook and OneNote with 1TB OneDrive cloud storage. Desktop apps on Windows and macOS, plus mobile apps. Activation on your own Microsoft account.',
   '12 Months', 6900, 1290, 'Within 30–90 minutes', 'in_stock', true, 'Official', 4.9, 486, 910, 1),

  ('software-productivity', 'Canva Pro', 'canva-pro', 'Canva',
   'Brand kit, 100M+ premium assets and full AI design suite.',
   'Canva Pro on your own account with 100M+ premium photos, videos and graphics, brand kits, background remover, Magic Studio AI tools, and cloud storage. Perfect for social media and business design.',
   '12 Months', 6500, 990, 'Within 30–60 minutes', 'in_stock', true, 'Best Value', 4.9, 512, 1120, 2),

  ('software-productivity', 'Adobe Creative Cloud All Apps', 'adobe-creative-cloud', 'Adobe',
   'Photoshop, Illustrator, Premiere Pro and 20+ apps — one month.',
   'Adobe Creative Cloud All Apps with Photoshop, Illustrator, Premiere Pro, After Effects, InDesign, Lightroom and 20+ creative apps plus cloud storage. Activation on your own Adobe ID.',
   '1 Month', 3400, 1290, 'Within 1–3 hours', 'limited', true, null, 4.7, 168, 290, 3),

  ('software-productivity', 'Notion Plus', 'notion-plus', 'Notion',
   'Unlimited blocks, AI writing and team collaboration.',
   'Notion Plus with unlimited file uploads, unlimited guests, AI writing assistance, and advanced permissions. Great for students and small teams building a second brain.',
   '12 Months', 4800, 1090, 'Within 1–3 hours', 'in_stock', false, null, 4.7, 132, 240, 4),

  ('software-productivity', 'Grammarly Premium', 'grammarly-premium', 'Grammarly',
   'Advanced grammar, tone and plagiarism checks.',
   'Grammarly Premium with advanced grammar and style corrections, tone adjustments, plagiarism detection, and full-sentence rewrites across email, docs and the web.',
   '1 Month', 2200, 690, 'Within 1–3 hours', 'in_stock', false, null, 4.6, 108, 200, 5),

  ('software-productivity', 'Google Workspace Business', 'google-workspace-business', 'Google',
   'Professional email on your domain with 2TB Drive.',
   'Google Workspace Business Standard with professional email on your own domain, 2TB Drive storage per user, Meet with recording, and full Docs, Sheets and Slides suite.',
   '12 Months', 8400, 2290, 'Within 6–24 hours', 'in_stock', false, null, 4.8, 64, 120, 6),

  -- Gaming & entertainment
  ('gaming-entertainment', 'Spotify Premium Individual', 'spotify-premium-individual', 'Spotify',
   'Ad-free music, offline listening and high-quality audio.',
   'Spotify Premium Individual on your own account: ad-free music, unlimited skips, offline downloads, high-quality audio and podcasts. Upgrade is applied to your existing Spotify account.',
   '3 Months', 1800, 590, 'Within 30–90 minutes', 'in_stock', true, 'Popular', 4.8, 392, 830, 1),

  ('gaming-entertainment', 'YouTube Premium', 'youtube-premium', 'YouTube',
   'Ad-free YouTube, background play and YouTube Music.',
   'YouTube Premium on your own Google account with ad-free viewing, background playback, offline downloads and YouTube Music Premium included.',
   '1 Month', 450, 229, 'Within 30–90 minutes', 'in_stock', true, null, 4.8, 341, 760, 2),

  ('gaming-entertainment', 'PlayStation Plus Essential', 'playstation-plus-essential', 'PlayStation',
   'Monthly games, online multiplayer and exclusive discounts.',
   'PlayStation Plus Essential with monthly games, full online multiplayer access and member-only discounts on the PlayStation Store. Credentials or code delivered after verification.',
   '3 Months', 3200, 1490, 'Within 2–8 hours', 'in_stock', false, null, 4.6, 84, 160, 3),

  ('gaming-entertainment', 'Xbox Game Pass Ultimate', 'xbox-game-pass-ultimate', 'Xbox',
   'Hundreds of games on console, PC and cloud gaming.',
   'Xbox Game Pass Ultimate with access to hundreds of games across console, PC and cloud, plus Xbox Live Gold online multiplayer and EA Play membership.',
   '1 Month', 2400, 1090, 'Within 2–8 hours', 'limited', false, null, 4.7, 76, 130, 4),

  ('gaming-entertainment', 'Netflix + Spotify Combo', 'netflix-spotify-combo', 'NEXORA',
   'Private Netflix 4K profile plus Spotify Premium — one bundle, one price.',
   'Our most popular bundle: a private Netflix Premium 4K profile plus Spotify Premium Individual for a full month. Save more than buying them separately, with one support thread for both.',
   '1 Month', 1100, 599, 'Within 10–30 minutes', 'in_stock', true, 'Bundle', 4.9, 168, 320, 5),

  -- Design
  ('design-creative', 'Figma Professional', 'figma-professional', 'Figma',
   'Unlimited files, shared libraries and advanced prototyping.',
   'Figma Professional seat with unlimited Figma files, shared team libraries, advanced prototyping, and Dev Mode. Ideal for product designers working with a small team.',
   '12 Months', 6200, 1490, 'Within 1–4 hours', 'in_stock', false, null, 4.7, 92, 170, 1),

  ('design-creative', 'Envato Elements', 'envato-elements', 'Envato',
   'Unlimited premium templates, fonts, graphics and stock video.',
   'Envato Elements with unlimited downloads of premium WordPress themes, graphic templates, fonts, presentation decks, stock photos and video. Use in unlimited personal and client projects.',
   '1 Month', 2600, 890, 'Within 1–4 hours', 'in_stock', false, null, 4.7, 118, 210, 2),

  ('design-creative', 'Freepik Premium', 'freepik-premium', 'Freepik',
   'Unlimited AI image tools plus premium stock library.',
   'Freepik Premium with unlimited downloads from the premium stock library, AI image generator credits, and Premium AI editing tools for marketing and design teams.',
   '1 Month', 1900, 590, 'Within 1–4 hours', 'in_stock', false, null, 4.5, 74, 140, 3)
) as v(category_slug, name, slug, brand, short_description, description, duration,
       original_price, discounted_price, delivery_time, availability, is_featured,
       badge, rating, rating_count, sales_count, sort_order)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do update
  set category_id = excluded.category_id,
      name = excluded.name,
      brand = excluded.brand,
      short_description = excluded.short_description,
      description = excluded.description,
      duration = excluded.duration,
      original_price = excluded.original_price,
      discounted_price = excluded.discounted_price,
      delivery_time = excluded.delivery_time,
      availability = excluded.availability,
      is_featured = excluded.is_featured,
      badge = excluded.badge,
      rating = excluded.rating,
      rating_count = excluded.rating_count,
      sales_count = excluded.sales_count,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Payment methods (admin edits numbers in the dashboard)
-- ---------------------------------------------------------------------------
insert into public.payment_methods
  (method, display_name, account_name, account_number, account_type, bank_name, branch, instructions, is_active, sort_order)
select pm.method::public.payment_method, pm.display_name, pm.account_name, pm.account_number,
       pm.account_type, pm.bank_name, pm.branch, pm.instructions, pm.is_active, pm.sort_order
from (values
  ('bkash', 'bKash', 'NEXORA Subscriptions', '01575864415', 'Personal',
   null, null,
   '1) Open bKash app → Send Money. 2) Enter the number above. 3) Pay the exact order total. 4) Copy the Transaction ID (TrxID) from the confirmation message and submit it below.',
   true, 1),
  ('nagad', 'Nagad', 'NEXORA Subscriptions', '01575864415', 'Personal',
   null, null,
   '1) Open Nagad app → Send Money. 2) Enter the number above. 3) Pay the exact order total. 4) Copy the Transaction ID (TxnID) and submit it below.',
   true, 2),
  ('bank_transfer', 'Bank Transfer', 'NEXORA Subscriptions', '1234567890123', 'Current',
   'Dutch-Bangla Bank Ltd.', 'Dhanmondi, Dhaka',
   'Send the amount via BEFTN / NPSB (routing 1234567890124) or your bank app to the account above. In the reference field write your NEXORA order number, then submit the transfer reference number below.',
   true, 3)
) as pm(method, display_name, account_name, account_number, account_type, bank_name, branch, instructions, is_active, sort_order)
-- (values are cast in the SELECT list below)
where not exists (
  select 1 from public.payment_methods m where m.method::text = pm.method
);

-- ---------------------------------------------------------------------------
-- Website settings
-- ---------------------------------------------------------------------------
insert into public.website_settings (key, value, label, group_name, is_public) values
  ('site', jsonb_build_object(
      'name', 'NEXORA',
      'tagline', 'Premium Subscriptions — All in One Place',
      'hero_headline', 'Unlock a World of Premium Entertainment & More!',
      'hero_subtitle', 'Premium Subscriptions — All in One Place',
      'hero_cta', 'Explore Subscriptions',
      'hero_banner', '/brand/nexora-banner.png'
    ), 'Site identity & hero', 'general', true),

  ('contact', jsonb_build_object(
      'whatsapp', '+8801575864415',
      'phone', '01575864415',
      'email', 'nexora.sub01@gmail.com',
      'address', 'Dhanmondi, Dhaka, Bangladesh',
      'hours', 'Sat–Fri · 10:00 AM – 11:00 PM (BST)',
      'facebook', '',
      'messenger', ''
    ), 'Contact information', 'general', true),

  ('notices', jsonb_build_object(
      'announcement', 'Instant delivery on 40+ premium subscriptions · Verified bKash, Nagad & Bank payments',
      'announcement_active', true,
      'checkout_note', 'Payments are verified by a human within 30 minutes during business hours. You will get an email once your order is delivered.',
      'support_note', 'Need help choosing a plan? Message us on WhatsApp — we reply in minutes.'
    ), 'Announcement & notices', 'general', true),

  ('seo', jsonb_build_object(
      'title', 'NEXORA — Premium Subscriptions, All in One Place',
      'description', 'Bangladesh''s premium digital subscription store: OTT, AI tools, education, software and gaming. Instant delivery with verified manual payments.',
      'keywords', 'netflix bangladesh, chatgpt plus bd, buy subscription bd, bkash subscription store'
    ), 'SEO', 'general', true),

  ('trust', jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('title', 'Premium Accounts', 'text', 'Genuine plans, never cracked tools.'),
        jsonb_build_object('title', 'Super Fast Activation', 'text', 'Most orders delivered in under 30 minutes.'),
        jsonb_build_object('title', '100% Secure', 'text', 'Manual verification on bKash, Nagad & bank.'),
        jsonb_build_object('title', 'Trusted by Millions', 'text', '10,000+ happy customers across Bangladesh.')
      )
    ), 'Trust badges', 'homepage', true),

  ('rewards', jsonb_build_object(
      'referral_note', 'Refer a friend and get ৳50 wallet credit on their first delivered order.',
      'warranty_days', 30
    ), 'Customer promises', 'general', false)
on conflict (key) do update
  set value = public.website_settings.value || excluded.value,
      label = excluded.label,
      group_name = excluded.group_name;

-- ---------------------------------------------------------------------------
-- FAQs
-- ---------------------------------------------------------------------------
insert into public.faqs (question, answer, category, sort_order)
select f.* from (values
  ('How fast will I receive my subscription?',
   'Most orders are delivered within 10–30 minutes after your payment is verified. Our support hours are 10:00 AM to 11:00 PM (BST). Orders placed after hours are delivered first thing the next morning.',
   'Delivery', 1),
  ('How do I pay? Is bKash accepted?',
   'Yes. We accept bKash, Nagad and bank transfer. After placing an order you will see our merchant number and step-by-step instructions. Send the exact amount, then submit your Transaction ID on the order page — our team verifies it manually.',
   'Payment', 2),
  ('Is my payment safe if something goes wrong?',
   'Every payment is verified by a human before delivery. If a subscription cannot be delivered, you get a full refund to your bKash/Nagad number or a replacement — your choice. Refunds are processed within 24–72 hours.',
   'Payment', 3),
  ('Do I need my own account for Netflix or ChatGPT?',
   'It depends on the product. Netflix Premium is delivered as a private profile inside a Premium plan, so you use the shared login we provide and set your own PIN. For ChatGPT Plus, Claude Pro, Canva Pro and Spotify you give us your email and we upgrade your own account in most cases. Each product page states the delivery model clearly.',
   'Products', 4),
  ('Can I use a subscription on more than one device?',
   'Yes for most products. Netflix Premium supports up to 4 simultaneous screens on the plan, Spotify allows multiple devices, and Microsoft 365 covers up to 5 devices. The exact limits are listed on each product page.',
   'Products', 5),
  ('What happens if my subscription stops working?',
   'Message our support on WhatsApp with your order number and we fix or replace it within 24 hours. All subscriptions are covered by a 30-day replacement warranty from the delivery date.',
   'Support', 6),
  ('Can I cancel an order?',
   'You can cancel any order that has not been delivered yet by contacting support. If payment was already verified but delivery has not happened, we refund the full amount.',
   'Orders', 7),
  ('Do you offer bulk or reseller pricing?',
   'Yes. If you need 5 or more subscriptions per month, contact us on WhatsApp with your requirements and we will send a reseller price list.',
   'Business', 8),
  ('Do I need an account to place an order?',
   'No — guest checkout is supported. But creating a free account lets you see all orders, track status and re-order in one click. You can always claim a guest order to your account later.',
   'Orders', 9),
  ('Which payment methods are verified the fastest?',
   'bKash and Nagad are usually verified within 10–20 minutes. Bank transfers can take longer because of bank confirmation cycles — expect up to a few hours during business days.',
   'Payment', 10)
) as f(question, answer, category, sort_order)
where not exists (select 1 from public.faqs x where x.question = f.question);

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------
insert into public.promotions
  (title, subtitle, description, badge, cta_label, cta_link, discount_text, is_active, sort_order)
select p.* from (values
  ('Netflix 4K + Spotify Bundle', 'Two premium services, one flat price',
   'Keep your entertainment fully covered this month: private Netflix 4K profile plus Spotify Premium Individual.',
   'Bundle Deal', 'Get the Bundle', '/product/netflix-spotify-combo', 'Save 45%', true, 1),
  ('ChatGPT Plus — Trending', 'The AI tool everyone is buying',
   'Private ChatGPT Plus account with frontier models and priority access. Delivered in under 45 minutes.',
   'AI Pick', 'Explore AI Tools', '/category/ai-premium-tools', 'From ৳1,190', true, 2),
  ('Microsoft 365 — 12 Months', 'Official activation on your own account',
   'Word, Excel, PowerPoint and 1TB OneDrive for a full year at 80% off retail price.',
   'Best Value', 'Buy Now', '/product/microsoft-365-family', 'Save 81%', true, 3)
) as p(title, subtitle, description, badge, cta_label, cta_link, discount_text, is_active, sort_order)
where not exists (select 1 from public.promotions x where x.title = p.title);

-- ---------------------------------------------------------------------------
-- Approved customer reviews (public testimonials)
-- ---------------------------------------------------------------------------
insert into public.reviews (customer_name, customer_city, rating, comment, is_approved)
select r.* from (values
  ('Tanvir Ahmed', 'Dhaka', 5, 'Ordered Netflix Premium at 1 AM and got the login within 15 minutes. Private profile with my own PIN — exactly as promised.', true),
  ('Sadia Rahman', 'Chattogram', 5, 'Bought ChatGPT Plus for my thesis work. Payment verified on bKash in minutes and the account is completely private. Genuinely reliable.', true),
  ('Rafid Hasan', 'Sylhet', 5, 'Third order from NEXORA. Canva Pro and Microsoft 365 both activated on my own accounts. Support replies on WhatsApp instantly.', true),
  ('Nusrat Jahan', 'Dhaka', 4, 'Great prices and honest support. Delivery took about an hour because I ordered at midnight, but they kept me updated the whole time.', true),
  ('Imran Kabir', 'Khulna', 5, 'I was sceptical about buying subscriptions online, but the manual verification system makes it feel safe. Got my Disney+ profile in 12 minutes.', true),
  ('Farhana Akter', 'Rajshahi', 5, 'Coursera Plus at this price is unreal. Certificate works and my university accepted it. Real people handling the support too.', true),
  ('Mehedi Hasan', 'Barishal', 5, 'Bought the Netflix + Spotify bundle for my sister. Everything worked first try and renewals are one message away.', true),
  ('Ayesha Siddika', 'Dhaka', 5, 'Spotify Premium upgraded on my own account in 40 minutes. Two months in, zero issues. This is my go-to store now.', true)
) as r(customer_name, customer_city, rating, comment, is_approved)
where not exists (select 1 from public.reviews x where x.customer_name = r.customer_name and x.comment = r.comment);
