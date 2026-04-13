import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  MapPin, 
  Navigation, 
  Shield, 
  Search, 
  Clock, 
  ChevronRight,
  Activity,
  AlertCircle,
  Hospital as HospitalIcon
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, FirestoreOperation } from '../lib/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Hospital {
  id: string;
  name: string;
  distance: string;
  status: 'open' | 'limited' | 'emergency-only';
  address: string;
  phone: string;
  specialties: string[];
  waitingTime: string;
  location: { lat: number; lng: number };
}

const MOCK_HOSPITALS: Hospital[] = [
  { 
    id: 'h1', 
    name: 'St. Mary\'s General Hospital', 
    distance: '1.2 km', 
    status: 'limited', 
    address: '456 Health Ave, City Center', 
    phone: '(555) 123-4567',
    specialties: ['Emergency', 'Trauma', 'Surgery'],
    waitingTime: '45 mins',
    location: { lat: 40.7100, lng: -74.0020 }
  },
  { 
    id: 'h2', 
    name: 'City Children\'s Medical Center', 
    distance: '3.5 km', 
    status: 'open', 
    address: '789 Pediatric Way', 
    phone: '(555) 987-6543',
    specialties: ['Pediatrics', 'Neonatal'],
    waitingTime: '15 mins',
    location: { lat: 40.7250, lng: -74.0200 }
  },
  { 
    id: 'h3', 
    name: 'Northside Community Clinic', 
    distance: '0.9 km', 
    status: 'emergency-only', 
    address: '101 North St', 
    phone: '(555) 444-5555',
    specialties: ['Basic First Aid', 'Wound Care'],
    waitingTime: '2 hours',
    location: { lat: 40.7300, lng: -73.9900 }
  },
  { 
    id: 'h4', 
    name: 'West End Trauma Center', 
    distance: '5.2 km', 
    status: 'open', 
    address: '202 West Blvd', 
    phone: '(555) 222-3333',
    specialties: ['Trauma', 'ICU', 'Radiology'],
    waitingTime: '30 mins',
    location: { lat: 40.6900, lng: -74.0500 }
  }
];

export default function HospitalsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [filteredHospitals, setFilteredHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Real-time Medical Resources Listener
    const medicalQuery = query(collection(db, 'resources'), where('type', '==', 'medical'));
    const unsubscribe = onSnapshot(medicalQuery, (snapshot) => {
      const hospitalList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hospital[];
      setHospitals(hospitalList.length > 0 ? hospitalList : MOCK_HOSPITALS);
      setIsLoading(false);
    }, (error) => {
      console.error("Hospitals listener error:", error);
      setHospitals(MOCK_HOSPITALS);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const filtered = hospitals.filter(h => 
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.specialties && h.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())))
    );
    setFilteredHospitals(filtered);
  }, [searchQuery, hospitals]);

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone.replace(/\D/g, '')}`;
  };

  const handleNavigate = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const handleEmergencyCall = () => {
    window.location.href = 'tel:911';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Nearby Hospitals</h2>
        <p className="text-slate-500">Find medical assistance and emergency care facilities near your current location.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="Search by name, specialty, or address..." 
          className="pl-10 h-12 bg-white shadow-sm border-slate-200 rounded-xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filteredHospitals.length > 0 ? (
            filteredHospitals.map((hospital) => (
              <Card key={hospital.id} className="border-none shadow-md hover:shadow-lg transition-all overflow-hidden group">
                <div className="flex flex-col sm:flex-row">
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">{hospital.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" /> {hospital.address}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={hospital.status === 'open' ? 'secondary' : hospital.status === 'limited' ? 'outline' : 'destructive'}
                        className="capitalize"
                      >
                        {hospital.status.replace('-', ' ')}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 my-4">
                      {hospital.specialties.map(s => (
                        <Badge key={s} variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal">
                          {s}
                        </Badge>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Navigation className="w-4 h-4 text-blue-500" />
                        <span>{hospital.distance}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <span>Wait: {hospital.waitingTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-1 col-span-2">
                        <Phone className="w-4 h-4 text-green-500" />
                        <span>{hospital.phone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 sm:w-32 flex flex-row sm:flex-col justify-center items-center gap-2 border-t sm:border-t-0 sm:border-l">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="rounded-full h-10 w-10 bg-white shadow-sm"
                      onClick={() => handleCall(hospital.phone)}
                    >
                      <Phone className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="rounded-full h-10 w-10 bg-white shadow-sm"
                      onClick={() => handleNavigate(hospital.location.lat, hospital.location.lng)}
                    >
                      <Navigation className="w-4 h-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 sm:mt-auto">
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="py-20 text-center space-y-4 bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium">No hospitals found matching your search.</p>
              <Button variant="link" onClick={() => setSearchQuery('')}>Clear search</Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-lg bg-red-600 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Emergency Protocol
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-red-100">
                If you are experiencing a life-threatening emergency, call 911 immediately.
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <div className="bg-white/20 p-1 rounded mt-0.5">1</div>
                  <p>Check for structural safety before leaving your location.</p>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <div className="bg-white/20 p-1 rounded mt-0.5">2</div>
                  <p>Bring identification and any essential medications.</p>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <div className="bg-white/20 p-1 rounded mt-0.5">3</div>
                  <p>Follow marked evacuation routes to avoid flooding.</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full bg-white text-red-600 hover:bg-red-50 font-bold"
                onClick={handleEmergencyCall}
              >
                <Phone className="w-4 h-4 mr-2" /> CALL 911 NOW
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Medical Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Blood Bank Status</span>
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Stable</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Oxygen Supply</span>
                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Limited</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">First Aid Kits</span>
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Available</Badge>
              </div>
              <Separator />
              <div className="bg-blue-50 p-3 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-800">
                  Hospitals are currently prioritizing trauma cases. For minor injuries, please visit a local community clinic.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
