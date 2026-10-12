export interface ShelterDestination {
  id: string;
  name: string;
  cityId: string;
  type: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  lat: number;
  lng: number;
  capacityMeals: number;
  dietaryPreference?: 'Veg only' | 'All';
}

export const VERIFIED_SHELTERS: ShelterDestination[] = [
  // Mumbai
  {
    id: 'shelter_mum_hope',
    name: 'Hope Community Shelter & Kitchen',
    cityId: 'mumbai',
    type: 'Community Relief & Shelter',
    address: 'East Ward Community Center, Building 4, Andheri East, Mumbai',
    contactPerson: 'Sister Mary',
    contactPhone: '+91 98200 88771',
    lat: 19.1150,
    lng: 72.8680,
    capacityMeals: 200,
    dietaryPreference: 'All',
  },
  {
    id: 'shelter_mum_1',
    name: 'Sneha Sadan Child Care Home',
    cityId: 'mumbai',
    type: 'Children Home & Shelter',
    address: 'Near Holy Family Church, Chakala, Andheri East, Mumbai',
    contactPerson: 'Father Joseph Fernandes',
    contactPhone: '+91 98334 11200',
    lat: 19.1136,
    lng: 72.8697,
    capacityMeals: 180,
    dietaryPreference: 'All',
  },
  {
    id: 'shelter_mum_2',
    name: 'Mother Teresa Missionaries of Charity',
    cityId: 'mumbai',
    type: 'Elderly & Destitute Care',
    address: 'Vile Parle West, Near Station Road, Mumbai',
    contactPerson: 'Sister Mary Agnes',
    contactPhone: '+91 98200 44551',
    lat: 19.0988,
    lng: 72.8428,
    capacityMeals: 220,
    dietaryPreference: 'Veg only',
  },
  {
    id: 'shelter_mum_3',
    name: 'Akshaya Patra Community Center',
    cityId: 'mumbai',
    type: 'Community Food Kitchen',
    address: 'Dadar West, Near Senapati Bapat Marg, Mumbai',
    contactPerson: 'Suresh Patil',
    contactPhone: '+91 98190 33214',
    lat: 19.0178,
    lng: 72.8354,
    capacityMeals: 350,
    dietaryPreference: 'Veg only',
  },

  // Bengaluru
  {
    id: 'shelter_blr_1',
    name: 'Robin Hood Army Distribution Center',
    cityId: 'bengaluru',
    type: 'Slum Community Distribution',
    address: 'Ejipura Main Road, Koramangala, Bengaluru',
    contactPerson: 'Ananya Sharma',
    contactPhone: '+91 99801 22345',
    lat: 12.9352,
    lng: 77.6245,
    capacityMeals: 250,
    dietaryPreference: 'All',
  },
  {
    id: 'shelter_blr_2',
    name: 'Hope Foundation Night Shelter',
    cityId: 'bengaluru',
    type: 'Night Shelter for Workers',
    address: 'Indiranagar 100ft Road, Bengaluru',
    contactPerson: 'Kiran Rao',
    contactPhone: '+91 98450 67123',
    lat: 12.9784,
    lng: 77.6408,
    capacityMeals: 160,
    dietaryPreference: 'All',
  },

  // Delhi NCR
  {
    id: 'shelter_del_1',
    name: 'Delhi Rain Basera Shelter Hub',
    cityId: 'delhi',
    type: 'Municipal Night Shelter',
    address: 'Near Bangla Sahib, Connaught Place, New Delhi',
    contactPerson: 'Rajender Kumar',
    contactPhone: '+91 98110 55432',
    lat: 28.6289,
    lng: 77.2085,
    capacityMeals: 300,
    dietaryPreference: 'All',
  },
  {
    id: 'shelter_del_2',
    name: 'Goonj Urban Relief Center',
    cityId: 'delhi',
    type: 'Community Relief Center',
    address: 'Sarita Vihar, South Delhi, New Delhi',
    contactPerson: 'Priya Mehra',
    contactPhone: '+91 98100 89234',
    lat: 28.5298,
    lng: 77.2945,
    capacityMeals: 220,
    dietaryPreference: 'Veg only',
  },

  // Hyderabad
  {
    id: 'shelter_hyd_1',
    name: 'Aman Vedika Rainbow Home',
    cityId: 'hyderabad',
    type: 'Child Care Shelter',
    address: 'Nampally Station Road, Hyderabad',
    contactPerson: 'Bala Krishna',
    contactPhone: '+91 99490 12345',
    lat: 17.3916,
    lng: 78.4682,
    capacityMeals: 150,
    dietaryPreference: 'All',
  },

  // Pune
  {
    id: 'shelter_pun_1',
    name: 'Seva Sahayog Foundation Kitchen',
    cityId: 'pune',
    type: 'Community Pantry',
    address: 'Shivaji Nagar, Pune',
    contactPerson: 'Vikas Joshi',
    contactPhone: '+91 98220 34567',
    lat: 18.5314,
    lng: 73.8446,
    capacityMeals: 200,
    dietaryPreference: 'All',
  },

  // Chennai
  {
    id: 'shelter_che_1',
    name: 'Udhavum Karangal Shelter',
    cityId: 'chennai',
    type: 'Elderly & Destitute Care',
    address: 'Thiruvanmiyur, Chennai',
    contactPerson: 'S. Ramanathan',
    contactPhone: '+91 98400 98765',
    lat: 12.9830,
    lng: 78.2594,
    capacityMeals: 180,
    dietaryPreference: 'Veg only',
  },

  // Kolkata
  {
    id: 'shelter_kol_1',
    name: 'Nirmal Hriday Home for Destitute',
    cityId: 'kolkata',
    type: 'Destitute Care Home',
    address: 'Kalighat, Kolkata',
    contactPerson: 'Sister Teresa Maria',
    contactPhone: '+91 98300 45678',
    lat: 22.5204,
    lng: 88.3444,
    capacityMeals: 240,
    dietaryPreference: 'All',
  },
];

export function getSheltersForCity(cityId: string): ShelterDestination[] {
  if (cityId === 'all') return VERIFIED_SHELTERS;
  const filtered = VERIFIED_SHELTERS.filter((s) => s.cityId === cityId);
  return filtered.length > 0 ? filtered : VERIFIED_SHELTERS.slice(0, 3);
}
