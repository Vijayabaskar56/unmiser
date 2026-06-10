// Static seed data: the default system categories + subcategories, ported 1:1
// from the Android Cashiro seed (di/DatabaseModule.kt, v51). This module is the
// single source of truth for the shipped defaults and for category reset.
// See docs/adr/0004-category-seed-and-reset-via-seedkey.md and ADR-0003 (iconName
// is the stable R.drawable.* identifier string).
//
// 33 categories, 215 subcategories. The Kotlin seed references a "Return" category
// id that has no CategoryData entry and no subcategory list — it is a dead lookup
// and is intentionally omitted here.

export interface SeedSubcategory {
  /** Stable identity, unique within its parent category. */
  seedKey: string;
  /** Parent category seedKey. */
  categorySeedKey: string;
  name: string;
  iconName: string;
  color: string;
}

export interface SeedCategory {
  /** Stable identity (slug of the original name), unique across categories. */
  seedKey: string;
  name: string;
  /** Verbatim description from the Android Cashiro seed. */
  description: string;
  color: string;
  /** Stable R.drawable.* identifier string (ADR-0003). */
  iconName: string;
  isIncome: boolean;
  displayOrder: number;
}

export interface SeedAccount {
  seedKey: string;
  bankName: string;
  accountLast4: string;
  iconName: string;
  color: string;
  currency: string;
  isWallet: boolean;
}

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  {
    seedKey: "food",
    name: "Food & Drinks",
    description: "Eating out, Swiggy, Zomato etc.",
    color: "#FC8019",
    iconName: "type_food_stuffed_flatbread",
    isIncome: false,
    displayOrder: 1,
  },
  {
    seedKey: "transport",
    name: "Transport",
    description: "Uber, Ola and other modes of transport.",
    color: "#0066CC",
    iconName: "type_travel_transport_airplane",
    isIncome: false,
    displayOrder: 2,
  },
  {
    seedKey: "shopping",
    name: "Shopping",
    description: "Clothes, shoes, furnitures etc.",
    color: "#893BBE",
    iconName: "type_shopping_shopping_bags",
    isIncome: false,
    displayOrder: 3,
  },
  {
    seedKey: "groceries",
    name: "Groceries",
    description: "Kitchen and other household supplies",
    color: "#9E7155",
    iconName: "type_groceries_bread",
    isIncome: false,
    displayOrder: 4,
  },
  {
    seedKey: "home",
    name: "Home",
    description: "Household related expenses",
    color: "#FFC107",
    iconName: "type_event_and_place_house",
    isIncome: false,
    displayOrder: 5,
  },
  {
    seedKey: "entertainment",
    name: "Entertainment",
    description: "Movies, Concerts and other recreations",
    color: "#CC1A56",
    iconName: "type_snack_popcorn",
    isIncome: false,
    displayOrder: 6,
  },
  {
    seedKey: "events",
    name: "Events",
    description: "Being social while putting a dent in bank account",
    color: "#9C27B0",
    iconName: "type_event_and_place_party_popper",
    isIncome: false,
    displayOrder: 7,
  },
  {
    seedKey: "travel",
    name: "Travel",
    description: "Exploration, fun and vacations!",
    color: "#0066CC",
    iconName: "type_travel_transport_luggage",
    isIncome: false,
    displayOrder: 8,
  },
  {
    seedKey: "medical",
    name: "Medical",
    description: "Medicines, Doctor consultations etc",
    color: "#FF0041",
    iconName: "type_health_pill",
    isIncome: false,
    displayOrder: 9,
  },
  {
    seedKey: "personal",
    name: "Personal",
    description: "Money spent on yourself",
    color: "#9C27B0",
    iconName: "type_tool_electronic_scissors",
    isIncome: false,
    displayOrder: 10,
  },
  {
    seedKey: "fitness",
    name: "Fitness",
    description: "Things to keep your biological machinery in tune",
    color: "#91CC4D",
    iconName: "type_sports_baseball",
    isIncome: false,
    displayOrder: 11,
  },
  {
    seedKey: "services",
    name: "Services",
    description: "Professional tasks provided for a fee",
    color: "#FF9800",
    iconName: "type_tool_electronic_high_voltage",
    isIncome: false,
    displayOrder: 12,
  },
  {
    seedKey: "bill",
    name: "Bill",
    description: "Rent, Wi-fi, electricity and other bills",
    color: "#FF0041",
    iconName: "type_travel_transport_admission_tickets",
    isIncome: false,
    displayOrder: 13,
  },
  {
    seedKey: "subscription",
    name: "Subscription",
    description: "Recurring payment to online services",
    color: "#5CCC4D",
    iconName: "type_tool_electronic_clapper_board",
    isIncome: false,
    displayOrder: 14,
  },
  {
    seedKey: "emi",
    name: "EMI",
    description: "Repayment of Loan",
    color: "#FF0041",
    iconName: "type_travel_transport_automobile",
    isIncome: false,
    displayOrder: 15,
  },
  {
    seedKey: "credit-bill",
    name: "Credit Bill",
    description: "Credit Card & other services settlement",
    color: "#FF9800",
    iconName: "type_stationary_card_file_box",
    isIncome: false,
    displayOrder: 16,
  },
  {
    seedKey: "investment",
    name: "Investment",
    description: "Money put towards investment",
    color: "#91CC4D",
    iconName: "type_flower_and_tree_herb",
    isIncome: false,
    displayOrder: 17,
  },
  {
    seedKey: "support",
    name: "Support",
    description: "Financial support for loved ones",
    color: "#673AB7",
    iconName: "type_health_stethoscope",
    isIncome: false,
    displayOrder: 18,
  },
  {
    seedKey: "insurance",
    name: "Insurance",
    description: "Payment towards insurance premiums",
    color: "#FF0041",
    iconName: "type_health_mending_heart",
    isIncome: false,
    displayOrder: 19,
  },
  {
    seedKey: "tax",
    name: "Tax",
    description: "Income tax, property tac, etc",
    color: "#FF5722",
    iconName: "type_finance_chart_decreasing",
    isIncome: false,
    displayOrder: 20,
  },
  {
    seedKey: "top-up",
    name: "Top-up",
    description: "Money added to online wallet",
    color: "#FF9800",
    iconName: "type_finance_money_bag",
    isIncome: false,
    displayOrder: 21,
  },
  {
    seedKey: "children",
    name: "Children",
    description: "It takes a village to raise a child & a ton of cash",
    color: "#8BC34A",
    iconName: "type_event_and_place_houses",
    isIncome: false,
    displayOrder: 22,
  },
  {
    seedKey: "pet-care",
    name: "Pet Care",
    description: "Money spent taking care of your snugglebug",
    color: "#F44336",
    iconName: "type_animal_dog_face",
    isIncome: false,
    displayOrder: 23,
  },
  {
    seedKey: "business",
    name: "Business",
    description: "24/7 over 9 to 5",
    color: "#795548",
    iconName: "type_finance_classical_building",
    isIncome: false,
    displayOrder: 24,
  },
  {
    seedKey: "miscellaneous",
    name: "Miscellaneous",
    description: "Everything else",
    color: "#91CC4D",
    iconName: "type_stationary_clipboard",
    isIncome: false,
    displayOrder: 25,
  },
  {
    seedKey: "self-transfer",
    name: "Self Transfer",
    description: "Transfer between personal Bank accounts",
    color: "#795548",
    iconName: "type_finance_bank",
    isIncome: false,
    displayOrder: 26,
  },
  {
    seedKey: "savings",
    name: "Savings",
    description: "For goals and dreams",
    color: "#FF0041",
    iconName: "type_sports_bullseye",
    isIncome: false,
    displayOrder: 27,
  },
  // Note: Android assigns "Gift" displayOrder 25 (a duplicate of Miscellaneous); ported faithfully.
  {
    seedKey: "gift",
    name: "Gift",
    description: "Money gifted or spent buying gifts :)",
    color: "#FF5722",
    iconName: "type_stationary_wrapped_gift",
    isIncome: false,
    displayOrder: 25,
  },
  {
    seedKey: "lent",
    name: "Lent",
    description: "Money lent with expectation of return",
    color: "#4CAF50",
    iconName: "type_finance_money_with_wings",
    isIncome: false,
    displayOrder: 28,
  },
  {
    seedKey: "donation",
    name: "Donation",
    description: "Contributions to charities and NGOs",
    color: "#FF4081",
    iconName: "type_health_drop_of_blood",
    isIncome: false,
    displayOrder: 29,
  },
  {
    seedKey: "hidden-charges",
    name: "Hidden Charges",
    description: "Bank's Hidden subscription charges",
    color: "#F44336",
    iconName: "type_animal_goblin",
    isIncome: false,
    displayOrder: 30,
  },
  {
    seedKey: "cash-withdrawal",
    name: "Cash Withdrawal",
    description: "Cash taken out from ATM or bank",
    color: "#8BC34A",
    iconName: "type_finance_dollar_banknote",
    isIncome: false,
    displayOrder: 31,
  },
  {
    seedKey: "income",
    name: "Income",
    description: "Generic income",
    color: "#4CAF50",
    iconName: "type_finance_money_bag",
    isIncome: true,
    displayOrder: 0,
  },
] as const;

// Raw subcategory definitions per parent category seedKey. seedKey is derived
// below as `${categorySeedKey}/${slug(name)}` to guarantee global uniqueness even
// when the same display name (e.g. "Vehicle", "Software") repeats across parents.
const RAW_SUBCATEGORIES: Record<
  string,
  ReadonlyArray<{ name: string; iconName: string; color: string }>
> = {
  food: [
    { name: "Eating out", iconName: "type_food_dining", color: "#423D3A" },
    { name: "Take Away", iconName: "type_food_takeout", color: "#423D3A" },
    { name: "Tea & Coffee", iconName: "type_beverages_tea", color: "#B75300" },
    { name: "Fast Food", iconName: "type_food_hamburger", color: "#FF5722" },
    { name: "Snacks", iconName: "type_snack_cookie", color: "#993414" },
    { name: "Swiggy", iconName: "ic_brand_swiggy", color: "#FF5722" },
    { name: "Zomato", iconName: "ic_brand_zomato", color: "#FF0041" },
    { name: "Sweets", iconName: "type_sweet_cupcake", color: "#9C27B0" },
    { name: "Liquor", iconName: "type_beverages_beer", color: "#FF9800" },
    { name: "Beverages", iconName: "type_beverages_bubble_tea", color: "#995B00" },
    { name: "Date", iconName: "type_food_sushi", color: "#FF5722" },
    { name: "Pizza", iconName: "type_food_pizza", color: "#FF5722" },
    { name: "Tiffin", iconName: "type_food_bento_box", color: "#66483D" },
  ],
  transport: [
    { name: "Uber", iconName: "ic_brand_uber", color: "#423D3A" },
    { name: "Rapido", iconName: "ic_brand_rapido", color: "#423D3A" },
    { name: "Auto", iconName: "type_travel_transport_auto_rickshaw", color: "#B75300" },
    { name: "Cab", iconName: "type_travel_transport_taxi", color: "#FF5722" },
    { name: "Train", iconName: "type_travel_transport_high_speed_train", color: "#993414" },
    { name: "Metro", iconName: "type_travel_transport_metro", color: "#FF5722" },
    { name: "Bus", iconName: "type_travel_transport_bus", color: "#FF0041" },
    { name: "Bike", iconName: "type_travel_transport_motorcycle", color: "#9C27B0" },
    { name: "Fuel", iconName: "type_travel_transport_fuel_pump", color: "#FF9800" },
    { name: "Ev Charge", iconName: "type_tool_electronic_high_voltage", color: "#995B00" },
    { name: "Flights", iconName: "type_travel_transport_airplane", color: "#FF5722" },
    { name: "Parking", iconName: "type_travel_transport_ticket", color: "#FF5722" },
    { name: "FASTag", iconName: "type_travel_transport_ticket", color: "#66483D" },
    { name: "Tolls", iconName: "type_travel_transport_ticket", color: "#66483D" },
    { name: "Lounge", iconName: "type_travel_transport_luggage", color: "#66483D" },
    { name: "Fine", iconName: "type_travel_transport_ticket", color: "#66483D" },
  ],
  shopping: [
    { name: "Clothes", iconName: "type_shopping_necktie", color: "#423D3A" },
    { name: "Footwear", iconName: "type_shopping_mans_shoe", color: "#423D3A" },
    { name: "Electronics", iconName: "type_tool_electronic_desktop_computer", color: "#B75300" },
    { name: "Festival", iconName: "type_event_and_place_firecracker", color: "#FF5722" },
    { name: "Video games", iconName: "type_tool_electronic_video_game", color: "#993414" },
    { name: "Books", iconName: "type_stationary_blue_book", color: "#FF5722" },
    { name: "Plants", iconName: "type_flower_and_tree_potted_plant", color: "#FF0041" },
    { name: "Jewellery", iconName: "type_shopping_gem_stone", color: "#9C27B0" },
    { name: "Furniture", iconName: "type_event_and_place_couch_and_lamp", color: "#FF9800" },
    { name: "Appliances", iconName: "type_tool_electronic_television", color: "#995B00" },
    { name: "Utensils", iconName: "type_tool_electronic_hammer_and_wrench", color: "#FF5722" },
    { name: "Vehicle", iconName: "type_travel_transport_automobile", color: "#FF5722" },
    { name: "Cosmetics", iconName: "type_shopping_nail_polish", color: "#66483D" },
    { name: "Toys", iconName: "type_shopping_top_hat", color: "#66483D" },
    { name: "Stationery", iconName: "type_stationary_artist_palette", color: "#66483D" },
    { name: "Glasses", iconName: "type_shopping_glasses", color: "#66483D" },
    { name: "Devotional", iconName: "type_event_and_place_diya_lamp", color: "#66483D" },
  ],
  groceries: [
    { name: "Staples", iconName: "type_vegetable_beans", color: "#423D3A" },
    { name: "Vegetables", iconName: "type_vegetable_broccoli", color: "#423D3A" },
    { name: "Fruits", iconName: "type_fruit_mango", color: "#B75300" },
    { name: "Meat", iconName: "type_groceries_cut_of_meat", color: "#FF5722" },
    { name: "Eggs", iconName: "type_groceries_egg", color: "#993414" },
    { name: "Bakery", iconName: "type_groceries_baguette_bread", color: "#FF5722" },
    { name: "Dairy", iconName: "type_groceries_glass_of_milk", color: "#FF0041" },
    { name: "Zepto", iconName: "ic_brand_zepto", color: "#9C27B0" },
  ],
  home: [
    { name: "Essentials", iconName: "type_groceries_basket", color: "#423D3A" },
    { name: "Toiletries", iconName: "type_groceries_soap", color: "#423D3A" },
    { name: "Decor", iconName: "type_flower_and_tree_hibiscus", color: "#B75300" },
    {
      name: "Cleaning",
      iconName: "type_flower_and_tree_leaf_fluttering_in_wind",
      color: "#FF5722",
    },
    { name: "Upkeep", iconName: "type_groceries_sponge", color: "#993414" },
    { name: "Painting", iconName: "type_stationary_artist_palette", color: "#FF5722" },
    { name: "Renovation", iconName: "type_tool_electronic_hammer_and_wrench", color: "#FF0041" },
    { name: "Pest-control", iconName: "type_animal_lady_beetle", color: "#9C27B0" },
    { name: "Construction", iconName: "type_tool_electronic_hammer", color: "#FF9800" },
  ],
  entertainment: [
    { name: "Movies", iconName: "type_snack_french_fries", color: "#423D3A" },
    { name: "Shows", iconName: "type_tool_electronic_clapper_board", color: "#423D3A" },
    { name: "Bowling", iconName: "type_sports_bowling", color: "#B75300" },
    { name: "Tickets", iconName: "type_travel_transport_admission_tickets", color: "#FF5722" },
  ],
  events: [
    { name: "Party", iconName: "type_event_and_place_party_popper", color: "#423D3A" },
    { name: "Birthday", iconName: "type_sweet_birthday_cake", color: "#FF5722" },
    { name: "Spiritual", iconName: "type_event_and_place_diya_lamp", color: "#423D3A" },
    { name: "Wedding", iconName: "type_event_and_place_wedding", color: "#B75300" },
  ],
  travel: [
    { name: "Activities", iconName: "type_sports_trophy", color: "#423D3A" },
    { name: "Camping", iconName: "type_event_and_place_camping", color: "#423D3A" },
    { name: "Hotel", iconName: "type_event_and_place_hotel", color: "#B75300" },
    { name: "Commute", iconName: "type_event_and_place_couch_and_lamp", color: "#FF5722" },
    { name: "Visa fees", iconName: "type_travel_transport_ticket", color: "#993414" },
    { name: "Hostel", iconName: "type_finance_classical_building", color: "#FF5722" },
    { name: "Airbnb", iconName: "ic_brand_airbnb", color: "#FF0041" },
    { name: "Oyo", iconName: "ic_brand_oyo", color: "#9C27B0" },
  ],
  medical: [
    { name: "Medicines", iconName: "type_health_pill", color: "#423D3A" },
    { name: "Hospital", iconName: "type_health_hospital", color: "#423D3A" },
    { name: "Clinic", iconName: "type_health_stethoscope", color: "#B75300" },
    { name: "Dentist", iconName: "type_health_tooth", color: "#FF5722" },
    { name: "Lab test", iconName: "type_shopping_lab_coat", color: "#993414" },
    { name: "Hygiene", iconName: "type_health_adhesive_bandage", color: "#FF5722" },
  ],
  personal: [
    { name: "Self-care", iconName: "type_groceries_lotion_bottle", color: "#423D3A" },
    { name: "Grooming", iconName: "type_tool_electronic_scissors", color: "#423D3A" },
    { name: "Hobbies", iconName: "type_sports_basketball", color: "#B75300" },
    { name: "Vices", iconName: "type_event_and_place_firecracker", color: "#FF5722" },
    { name: "Therapy", iconName: "type_health_mending_heart", color: "#993414" },
  ],
  fitness: [
    { name: "Gym", iconName: "type_sports_flexed_biceps_light", color: "#423D3A" },
    { name: "Badminton", iconName: "type_sports_badminton", color: "#423D3A" },
    { name: "Football", iconName: "type_sports_soccer_ball", color: "#B75300" },
    { name: "Cricket", iconName: "type_sports_cricket_game", color: "#FF5722" },
    { name: "Classes", iconName: "type_stationary_books", color: "#993414" },
    { name: "Equipment", iconName: "type_tool_electronic_screwdriver", color: "#FF5722" },
    { name: "Nutrition", iconName: "type_vegetable_broccoli", color: "#FF0041" },
  ],
  services: [
    { name: "Laundry", iconName: "type_shopping_necktie", color: "#423D3A" },
    { name: "Tailor", iconName: "type_shopping_scarf", color: "#423D3A" },
    { name: "Courier", iconName: "type_travel_transport_package", color: "#B75300" },
    { name: "Carpenter", iconName: "type_tool_electronic_carpentry_saw", color: "#FF5722" },
    { name: "Plumber", iconName: "type_tool_electronic_toolbox", color: "#993414" },
    { name: "Mechanic", iconName: "type_tool_electronic_hammer_and_wrench", color: "#FF5722" },
    { name: "Photographer", iconName: "type_tool_electronic_camera_with_flash", color: "#FF0041" },
    { name: "Driver", iconName: "type_travel_transport_oncoming_taxi", color: "#9C27B0" },
    { name: "Vehicle Wash", iconName: "type_travel_transport_automobile", color: "#FF9800" },
    { name: "Electrician", iconName: "type_tool_electronic_high_voltage", color: "#995B00" },
    { name: "Painting", iconName: "type_stationary_artist_palette", color: "#FF5722" },
    { name: "Xerox", iconName: "type_stationary_card_index", color: "#FF5722" },
    { name: "Legal", iconName: "type_stationary_reminder_ribbon", color: "#66483D" },
    { name: "Advisor", iconName: "type_stationary_bookmark", color: "#66483D" },
    { name: "Repair", iconName: "type_tool_electronic_hammer_and_pick", color: "#66483D" },
    { name: "Logistics", iconName: "type_travel_transport_delivery_truck", color: "#66483D" },
  ],
  bill: [
    { name: "Phone", iconName: "type_tool_electronic_mobile_phone", color: "#423D3A" },
    { name: "Rent", iconName: "type_event_and_place_house", color: "#423D3A" },
    { name: "Water", iconName: "type_beverages_sake", color: "#B75300" },
    { name: "Electricity", iconName: "type_tool_electronic_high_voltage", color: "#FF5722" },
    { name: "Gas", iconName: "type_travel_transport_fuel_pump", color: "#993414" },
    {
      name: "Internet",
      iconName: "type_travel_transport_globe_showing_asia_australia",
      color: "#FF5722",
    },
    { name: "House Help", iconName: "type_flower_and_tree_potted_plant", color: "#FF0041" },
    { name: "Education", iconName: "type_event_and_place_graduation_cap", color: "#9C27B0" },
    { name: "DTH", iconName: "type_tool_electronic_video_camera", color: "#FF9800" },
    { name: "Cook", iconName: "type_food_curry_rice", color: "#995B00" },
    { name: "Maintenance", iconName: "type_tool_electronic_hammer_and_wrench", color: "#FF5722" },
  ],
  subscription: [
    { name: "Software", iconName: "type_tool_electronic_laptop", color: "#423D3A" },
    { name: "News", iconName: "type_stationary_newspaper", color: "#423D3A" },
    { name: "Netflix", iconName: "ic_brand_netflix", color: "#B75300" },
    { name: "Prime", iconName: "ic_brand_amazon_prime", color: "#FF5722" },
    { name: "Youtube", iconName: "ic_brand_youtube", color: "#993414" },
    { name: "Youtube Music", iconName: "ic_brand_youtube_music", color: "#FF9800" },
    { name: "Spotify", iconName: "ic_brand_spotify", color: "#FF5722" },
    { name: "Google", iconName: "ic_brand_google", color: "#FF0041" },
    { name: "Learning", iconName: "type_stationary_writing_hand_light", color: "#9C27B0" },
    { name: "Apple Tv", iconName: "ic_brand_apple_tv", color: "#FF9800" },
    { name: "Apple Music", iconName: "ic_brand_apple_music", color: "#FF9800" },
    { name: "Bumble", iconName: "ic_brand_bumble", color: "#995B00" },
    { name: "JioCinema", iconName: "ic_brand_jiocinema", color: "#FF5722" },
    { name: "Google Play", iconName: "ic_brand_google_play", color: "#FF5722" },
    { name: "Xbox", iconName: "ic_brand_xbox", color: "#66483D" },
    { name: "PlayStation", iconName: "ic_brand_playstation", color: "#66483D" },
    { name: "Disney Plus", iconName: "ic_brand_disney_plus", color: "#66483D" },
    { name: "Zee5", iconName: "ic_brand_zee5", color: "#66483D" },
    { name: "ChatGPT", iconName: "ic_brand_chatgpt", color: "#66483D" },
    { name: "Claude", iconName: "ic_brand_claude", color: "#66483D" },
    { name: "Grok", iconName: "ic_brand_grok", color: "#66483D" },
  ],
  emi: [
    { name: "Electronics", iconName: "type_tool_electronic_software", color: "#423D3A" },
    { name: "House", iconName: "type_event_and_place_house", color: "#423D3A" },
    { name: "Vehicle", iconName: "type_travel_transport_automobile", color: "#B75300" },
    { name: "Education", iconName: "type_stationary_writing_hand_light", color: "#FF5722" },
  ],
  "credit-bill": [
    { name: "Credit Card", iconName: "type_finance_credit_card", color: "#423D3A" },
    { name: "Simpl", iconName: "ic_brand_simpl", color: "#423D3A" },
    { name: "Slice", iconName: "ic_brand_slice", color: "#B75300" },
    { name: "lazypay", iconName: "ic_brand_lazypay", color: "#FF5722" },
    { name: "Amazon Pay", iconName: "ic_brand_amazon", color: "#993414" },
  ],
  investment: [
    { name: "Mutual Funds", iconName: "type_flower_and_tree_herb", color: "#423D3A" },
    { name: "Stocks", iconName: "type_finance_chart_increasing", color: "#423D3A" },
    { name: "IPO", iconName: "type_finance_bar_chart", color: "#B75300" },
    { name: "PPF", iconName: "type_finance_dollar_banknote", color: "#FF5722" },
    { name: "Fixed Deposit", iconName: "type_finance_deposit", color: "#993414" },
    { name: "Recurring Deposit", iconName: "type_finance_tip", color: "#FF5722" },
    { name: "Assets", iconName: "type_finance_classical_building", color: "#FF0041" },
    { name: "Crypto", iconName: "type_finance_crypto", color: "#9C27B0" },
    { name: "Gold", iconName: "type_finance_coin", color: "#FF9800" },
  ],
  support: [
    { name: "Parents", iconName: "type_human_parents", color: "#423D3A" },
    { name: "Spouse", iconName: "type_human_woman", color: "#423D3A" },
    { name: "Mom", iconName: "type_human_old_woman", color: "#B75300" },
    { name: "Dad", iconName: "type_human_older_person", color: "#FF5722" },
    { name: "Pocket Money", iconName: "type_finance_money_bag", color: "#993414" },
  ],
  insurance: [
    { name: "Health", iconName: "type_health_drop_of_blood", color: "#423D3A" },
    { name: "Vehicle", iconName: "type_travel_transport_automobile", color: "#423D3A" },
    { name: "Life", iconName: "type_health_mending_heart", color: "#B75300" },
    { name: "Electronics", iconName: "type_tool_electronic_mobile_phone", color: "#FF5722" },
  ],
  tax: [
    { name: "Income Tax", iconName: "type_finance_chart_increasing", color: "#423D3A" },
    { name: "GST", iconName: "type_finance_tax_due", color: "#423D3A" },
    { name: "Property Tax", iconName: "type_finance_classical_building", color: "#B75300" },
  ],
  "top-up": [
    { name: "UPI Lite", iconName: "type_finance_bank", color: "#423D3A" },
    { name: "Paytm", iconName: "ic_brand_paytm", color: "#423D3A" },
    { name: "Amazon", iconName: "ic_brand_amazon", color: "#B75300" },
    { name: "PhonePe", iconName: "ic_brand_phonepe", color: "#FF5722" },
    { name: "Google pay", iconName: "ic_brand_google_pay", color: "#993414" },
  ],
  children: [
    { name: "Nutrition", iconName: "type_vegetable_pea_pod", color: "#423D3A" },
    { name: "Necessities", iconName: "type_stationary_pencil", color: "#423D3A" },
    { name: "Toys", iconName: "type_stationary_toys", color: "#B75300" },
    { name: "Medical", iconName: "type_health_pill", color: "#FF5722" },
    { name: "Care", iconName: "type_health_adhesive_bandage", color: "#993414" },
    { name: "Tuition Fee", iconName: "type_finance_money_bag", color: "#FF5722" },
    { name: "Classes Fee", iconName: "type_stationary_books", color: "#FF0041" },
    { name: "School Fee", iconName: "type_stationary_open_book", color: "#9C27B0" },
    { name: "College Fee", iconName: "type_finance_classical_building", color: "#FF9800" },
  ],
  "pet-care": [
    { name: "Food", iconName: "type_vegetable_beans", color: "#423D3A" },
    { name: "Toys", iconName: "type_stationary_toys", color: "#423D3A" },
    { name: "Grooming", iconName: "type_tool_electronic_scissors", color: "#B75300" },
    { name: "Vet", iconName: "type_health_vet", color: "#FF5722" },
  ],
  business: [
    { name: "Salary", iconName: "type_finance_money_with_wings", color: "#423D3A" },
    { name: "Inventory", iconName: "type_travel_transport_inventory", color: "#423D3A" },
    { name: "Rent", iconName: "type_event_and_place_house", color: "#B75300" },
    { name: "Logistics", iconName: "type_travel_transport_delivery_truck", color: "#FF5722" },
    { name: "Software", iconName: "type_tool_electronic_software", color: "#993414" },
    { name: "Marketing", iconName: "type_finance_bar_chart", color: "#FF5722" },
    { name: "Tax", iconName: "type_finance_tax_due", color: "#FF0041" },
    { name: "Insurance", iconName: "type_finance_insurance", color: "#9C27B0" },
    { name: "Service", iconName: "type_tool_electronic_light_bulb", color: "#FF9800" },
  ],
  miscellaneous: [
    { name: "Tip", iconName: "type_finance_tip", color: "#423D3A" },
    {
      name: "Verification",
      iconName: "type_tool_electronic_magnifying_glass_tilted_left",
      color: "#423D3A",
    },
    { name: "Forex", iconName: "type_finance_currency_exchange", color: "#B75300" },
    { name: "Deposit", iconName: "type_finance_deposit", color: "#FF5722" },
    { name: "Gift Cards", iconName: "type_stationary_gift_card", color: "#993414" },
  ],
  income: [
    { name: "Salary", iconName: "type_finance_coin", color: "#8BC34A" },
    { name: "Freelance", iconName: "type_stationary_clipboard", color: "#4CAF50" },
    { name: "Business", iconName: "type_finance_classical_building", color: "#8BC34A" },
    { name: "Bonus", iconName: "type_stationary_wrapped_gift", color: "#FFEB3B" },
    { name: "Gift", iconName: "type_stationary_wrapped_gift", color: "#FF9800" },
    { name: "Interest", iconName: "type_finance_chart_decreasing", color: "#8BC34A" },
    { name: "Refund", iconName: "type_finance_currency_exchange", color: "#03A9F4" },
    { name: "Other", iconName: "type_stationary_clipboard", color: "#9E9E9E" },
  ],
};

/** Slugify a display name into a seedKey fragment (lowercase, hyphenated). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const SEED_SUBCATEGORIES: readonly SeedSubcategory[] = Object.entries(
  RAW_SUBCATEGORIES,
).flatMap(([categorySeedKey, subs]) =>
  subs.map((s) => ({
    seedKey: `${categorySeedKey}/${slugify(s.name)}`,
    categorySeedKey,
    name: s.name,
    iconName: s.iconName,
    color: s.color,
  })),
);

// The default Cash wallet account, created at first launch (ADR-0004 home of
// seed-time defaults). isWallet = true; a synthetic last4 so the unique
// (bankName, accountLast4) index is satisfied.
export const SEED_CASH_ACCOUNT: SeedAccount = {
  seedKey: "cash",
  bankName: "Cash",
  accountLast4: "CASH",
  iconName: "type_finance_money_bag",
  color: "#4CAF50",
  currency: "INR",
  isWallet: true,
};
