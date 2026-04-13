import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Phone, 
  Shield, 
  Info, 
  MessageSquare, 
  Navigation, 
  Heart, 
  Zap, 
  Droplets, 
  Home,
  Send,
  Loader2,
  XCircle,
  AlertCircle,
  TreePine,
  ZapOff,
  Waves,
  CloudRain,
  Wind,
  Thermometer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, onSnapshot, query, addDoc, serverTimestamp, orderBy, limit, doc, setDoc, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, FirestoreOperation } from '../lib/firebase';
import { AuthContext } from '../App';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { getEmergencyGuidance } from '../services/geminiService';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Resource {
  id: string;
  name: string;
  type: 'shelter' | 'medical' | 'water' | 'food';
  distance: string;
  status: 'open' | 'full' | 'limited' | 'emergency-only';
  address: string;
  location: { lat: number; lng: number };
}

interface HazardReport {
  id: string;
  type: 'tree' | 'power' | 'flood' | 'other';
  description: string;
  location: { lat: number; lng: number } | null;
  timestamp: Date;
  status: 'reported' | 'verified' | 'cleared';
}

interface UserStatus {
  id: string;
  name: string;
  status: 'safe' | 'help';
  lastLocation: { lat: number; lng: number } | null;
}

const DEFAULT_CENTER: [number, number] = [40.7128, -74.0060]; // NYC as fallback

const MOCK_RESOURCES: Resource[] = [
  { id: '1', name: 'City Community Center', type: 'shelter', distance: '0.8 km', status: 'open', address: '123 Main St', location: { lat: 40.7150, lng: -74.0080 } },
  { id: '2', name: 'St. Mary\'s Hospital', type: 'medical', distance: '1.2 km', status: 'limited', address: '456 Health Ave', location: { lat: 40.7100, lng: -74.0020 } },
  { id: '3', name: 'Water Distribution Point A', type: 'water', distance: '0.5 km', status: 'open', address: '789 River Rd', location: { lat: 40.7180, lng: -74.0100 } },
  { id: '4', name: 'Food Bank Central', type: 'food', distance: '2.1 km', status: 'open', address: '101 Market St', location: { lat: 40.7050, lng: -73.9950 } },
];

const INITIAL_HAZARDS: HazardReport[] = [
  { id: 'h1', type: 'tree', description: 'Large oak blocking Oak Street', location: { lat: 40.7140, lng: -74.0050 }, timestamp: new Date(Date.now() - 3600000), status: 'reported' },
  { id: 'h2', type: 'power', description: 'Downed lines near Central Park', location: { lat: 40.7160, lng: -74.0070 }, timestamp: new Date(Date.now() - 7200000), status: 'verified' },
];

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function DashboardPage() {
  const authContext = React.useContext(AuthContext);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSafe, setIsSafe] = useState<boolean | null>(null);
  const [sosActive, setSosActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello. I'm your Cyclone Emergency Assistant. How can I help you stay safe today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [hazards, setHazards] = useState<HazardReport[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [helpNeededUsers, setHelpNeededUsers] = useState<UserStatus[]>([]);
  const [isResourcesLoading, setIsResourcesLoading] = useState(true);
  const [isHazardsLoading, setIsHazardsLoading] = useState(true);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('guide');

  const handleCallRescue = () => {
    window.location.href = 'tel:911';
  };

  const handleFindShelter = () => {
    setActiveTab('resources');
  };

  const handleGetDirections = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };
  const [newHazard, setNewHazard] = useState<{ type: HazardReport['type']; description: string }>({
    type: 'other',
    description: ''
  });

  // Real-time Weather State
  const [weather, setWeather] = useState({
    temp: '24°C',
    wind: '45 km/h',
    rain: '12mm/h',
    condition: 'Heavy Rain',
    lastUpdated: new Date()
  });

  useEffect(() => {
    if (!authContext?.user) return;

    // Real-time Current User Status Listener
    const unsubscribeUser = onSnapshot(doc(db, 'users', authContext.user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsSafe(data.status === 'safe');
      }
    });

    // Real-time Help Needed Users Listener
    const helpQuery = query(collection(db, 'users'), where('status', '==', 'help'));
    const unsubscribeHelp = onSnapshot(helpQuery, (snapshot) => {
      const helpList = snapshot.docs
        .filter(d => d.id !== authContext.user?.uid)
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserStatus[];
      setHelpNeededUsers(helpList);
    });

    // Real-time Hazards Listener
    const hazardsQuery = query(collection(db, 'hazards'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeHazards = onSnapshot(hazardsQuery, (snapshot) => {
      const hazardList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as HazardReport[];
      setHazards(hazardList);
      setIsHazardsLoading(false);
    }, (error) => {
      console.error("Hazards listener error:", error);
      setIsHazardsLoading(false);
    });

    // Real-time Resources Listener
    const resourcesQuery = query(collection(db, 'resources'));
    const unsubscribeResources = onSnapshot(resourcesQuery, (snapshot) => {
      const resourceList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Resource[];
      setResources(resourceList.length > 0 ? resourceList : MOCK_RESOURCES);
      setIsResourcesLoading(false);
    }, (error) => {
      console.error("Resources listener error:", error);
      setResources(MOCK_RESOURCES);
      setIsResourcesLoading(false);
    });

    // Simulate Real-time Weather Updates
    const weatherInterval = setInterval(() => {
      setWeather(prev => ({
        ...prev,
        wind: `${Math.floor(40 + Math.random() * 20)} km/h`,
        lastUpdated: new Date()
      }));
    }, 10000);

    return () => {
      unsubscribeUser();
      unsubscribeHelp();
      unsubscribeHazards();
      unsubscribeResources();
      clearInterval(weatherInterval);
    };
  }, [authContext?.user]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          setLocationError("Unable to retrieve location. Please enable GPS.");
          console.error(error);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    const guidance = await getEmergencyGuidance(input);
    setMessages(prev => [...prev, { role: 'assistant', content: guidance || "I'm sorry, I couldn't process that. Please try again." }]);
    setIsLoading(false);
  };

  const updateSafetyStatus = async (safe: boolean) => {
    if (!authContext?.user) return;
    
    try {
      await setDoc(doc(db, 'users', authContext.user.uid), {
        name: authContext.user.displayName || 'Anonymous User',
        email: authContext.user.email,
        status: safe ? 'safe' : 'help',
        role: 'user',
        lastLocation: location,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setIsSafe(safe);
    } catch (error) {
      handleFirestoreError(error, FirestoreOperation.UPDATE, `users/${authContext.user.uid}`);
    }
  };

  const toggleSos = () => {
    setSosActive(!sosActive);
    if (!sosActive) {
      updateSafetyStatus(false);
    }
  };

  const submitHazardReport = async () => {
    if (!authContext?.user) {
      alert("Please login to report a hazard.");
      return;
    }

    try {
      await addDoc(collection(db, 'hazards'), {
        type: newHazard.type,
        description: newHazard.description,
        location: location,
        timestamp: serverTimestamp(),
        status: 'reported',
        reporterUid: authContext.user.uid
      });
      setIsReportDialogOpen(false);
      setNewHazard({ type: 'other', description: '' });
    } catch (error) {
      handleFirestoreError(error, FirestoreOperation.CREATE, 'hazards');
    }
  };

  const getHazardIcon = (type: HazardReport['type']) => {
    switch (type) {
      case 'tree': return <TreePine className="w-4 h-4" />;
      case 'power': return <ZapOff className="w-4 h-4" />;
      case 'flood': return <Waves className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const mapCenter: [number, number] = location ? [location.lat, location.lng] : DEFAULT_CENTER;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Emergency Dashboard</h2>
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            {isSafe === null ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => updateSafetyStatus(true)} className="text-xs h-8">
                  I'm Safe
                </Button>
                <Button variant="destructive" size="sm" onClick={() => updateSafetyStatus(false)} className="text-xs h-8">
                  Need Help
                </Button>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <Badge variant={isSafe ? "secondary" : "destructive"} className="px-2 py-0.5">
                  {isSafe ? "Status: Safe" : "Status: Need Help"}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateSafetyStatus(!isSafe)}>
                  <XCircle className="w-4 h-4 text-slate-400" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 overflow-hidden border-none shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              Emergency Alert
              {sosActive && (
                <motion.span 
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-3 h-3 bg-red-500 rounded-full"
                />
              )}
            </CardTitle>
            <CardDescription className="text-slate-300">
              Press and hold the button for 3 seconds to send an emergency SOS with your location.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10 gap-6">
            <div className="relative">
              <AnimatePresence>
                {sosActive && (
                  <motion.div 
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 bg-red-500 rounded-full"
                  />
                )}
              </AnimatePresence>
              <Button 
                onClick={toggleSos}
                className={`relative w-40 h-40 rounded-full text-2xl font-black shadow-2xl transition-all duration-300 ${
                  sosActive 
                    ? 'bg-white text-red-600 hover:bg-slate-100' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {sosActive ? 'CANCEL' : 'SOS'}
              </Button>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 w-full">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
                <MapPin className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium">
                  {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : locationError || "Locating..."}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
                <Phone className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium">Emergency: 911</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                <DialogTrigger render={
                  <Button variant="destructive" className="justify-start gap-2 h-12 bg-red-50 hover:bg-red-100 text-red-700 border-red-200">
                    <AlertCircle className="w-4 h-4" /> Report Hazard
                  </Button>
                } />
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Report Hazard</DialogTitle>
                    <DialogDescription>
                      Help others by reporting dangerous situations in your area. Your current location will be included.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="type">Hazard Type</Label>
                      <Select 
                        value={newHazard.type} 
                        onValueChange={(v: HazardReport['type']) => setNewHazard({...newHazard, type: v})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tree">Fallen Tree</SelectItem>
                          <SelectItem value="power">Power Outage / Downed Lines</SelectItem>
                          <SelectItem value="flood">Flooding</SelectItem>
                          <SelectItem value="other">Other Hazard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea 
                        id="description" 
                        placeholder="Provide details about the hazard..." 
                        value={newHazard.description}
                        onChange={(e) => setNewHazard({...newHazard, description: e.target.value})}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={submitHazardReport} className="w-full bg-red-600 hover:bg-red-700">Submit Report</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline" className="justify-start gap-2 h-12" onClick={handleCallRescue}>
                <Phone className="w-4 h-4" /> Call Local Rescue
              </Button>
              <Button variant="outline" className="justify-start gap-2 h-12" onClick={handleFindShelter}>
                <Navigation className="w-4 h-4" /> Find Nearest Shelter
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                <CloudRain className="w-5 h-5" />
                Live Weather
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/50 p-2 rounded-lg flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-bold">{weather.temp}</span>
                </div>
                <div className="bg-white/50 p-2 rounded-lg flex items-center gap-2">
                  <Wind className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-bold">{weather.wind}</span>
                </div>
              </div>
              <p className="text-xs text-blue-800 font-medium">
                Condition: <span className="font-bold">{weather.condition}</span>
              </p>
              <div className="flex items-center justify-between text-[10px] text-blue-600/60">
                <span>Last updated: {weather.lastUpdated.toLocaleTimeString()}</span>
                <Badge variant="outline" className="h-4 text-[8px] border-blue-200">LIVE</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-12 bg-white shadow-sm rounded-xl p-1">
          <TabsTrigger value="guide" className="rounded-lg">AI Guide</TabsTrigger>
          <TabsTrigger value="map" className="rounded-lg">Map</TabsTrigger>
          <TabsTrigger value="resources" className="rounded-lg">Resources</TabsTrigger>
          <TabsTrigger value="hazards" className="rounded-lg">Hazards</TabsTrigger>
          <TabsTrigger value="info" className="rounded-lg">Tips</TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="mt-4">
          <Card className="border-none shadow-xl overflow-hidden flex flex-col h-[500px]">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                Emergency AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 relative">
              <ScrollArea className="h-full p-4" ref={scrollRef}>
                <div className="space-y-4 pb-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <Avatar className="w-8 h-8 border">
                          <AvatarFallback className={msg.role === 'user' ? 'bg-slate-200' : 'bg-blue-600 text-white'}>
                            {msg.role === 'user' ? 'U' : 'AI'}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`p-3 rounded-2xl text-sm ${
                          msg.role === 'user' 
                            ? 'bg-slate-900 text-white rounded-tr-none' 
                            : 'bg-slate-100 text-slate-800 rounded-tl-none'
                        }`}>
                          <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-3 max-w-[85%]">
                        <Avatar className="w-8 h-8 border">
                          <AvatarFallback className="bg-blue-600 text-white">AI</AvatarFallback>
                        </Avatar>
                        <div className="p-3 rounded-2xl bg-slate-100 text-slate-800 rounded-tl-none flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs font-medium">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="p-3 border-t bg-white">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex w-full gap-2">
                <Input 
                  placeholder="Ask about first aid, water, safety..." 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 h-10 rounded-full px-4 border-slate-200 focus-visible:ring-blue-500"
                />
                <Button type="submit" size="icon" className="rounded-full h-10 w-10 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <Card className="border-none shadow-xl overflow-hidden h-[500px]">
            <MapContainer center={mapCenter} zoom={14} className="h-full w-full z-0">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RecenterMap center={mapCenter} />
              {location && <Marker position={[location.lat, location.lng]}><Popup>Your Location</Popup></Marker>}
              {resources.map(resource => (
                <Marker key={resource.id} position={[resource.location.lat, resource.location.lng]}>
                  <Popup>
                    <div className="p-1">
                      <h4 className="font-bold text-sm">{resource.name}</h4>
                      <p className="text-xs text-slate-600 capitalize">{resource.type}</p>
                      <Badge variant="secondary" className="mt-2 text-[10px]">{resource.status}</Badge>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {hazards.map(hazard => hazard.location && (
                <Marker key={hazard.id} position={[hazard.location.lat, hazard.location.lng]}>
                  <Popup>
                    <div className="p-1">
                      <h4 className="font-bold text-sm text-red-600 capitalize">{hazard.type} Hazard</h4>
                      <p className="text-xs mt-1">{hazard.description}</p>
                      <Badge variant="destructive" className="mt-2 text-[10px]">{hazard.status}</Badge>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {helpNeededUsers.map(user => user.lastLocation && (
                <Marker 
                  key={user.id} 
                  position={[user.lastLocation.lat, user.lastLocation.lng]}
                  icon={L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                >
                  <Popup>
                    <div className="p-1">
                      <h4 className="font-bold text-sm text-red-600">Help Needed</h4>
                      <p className="text-xs font-medium">{user.name}</p>
                      <Badge variant="destructive" className="mt-2 text-[10px]">Active SOS</Badge>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resources.map((resource) => (
              <Card key={resource.id} className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">{resource.name}</CardTitle>
                    <CardDescription className="text-xs">{resource.address}</CardDescription>
                  </div>
                  <Badge variant={resource.status === 'open' ? 'secondary' : 'outline'} className="text-[10px] uppercase tracking-wider">
                    {resource.status}
                  </Badge>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      {resource.type === 'shelter' && <Home className="w-3 h-3" />}
                      {resource.type === 'medical' && <Shield className="w-3 h-3" />}
                      {resource.type === 'water' && <Droplets className="w-3 h-3" />}
                      {resource.type === 'food' && <Heart className="w-3 h-3" />}
                      <span className="capitalize">{resource.type}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      <span>{resource.distance}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button 
                    variant="ghost" 
                    className="w-full h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => handleGetDirections(resource.location.lat, resource.location.lng)}
                  >
                    Get Directions
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="hazards" className="mt-4">
          <div className="space-y-4">
            {hazards.map((hazard) => (
              <Card key={hazard.id} className="border-none shadow-md">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      hazard.type === 'power' ? 'bg-yellow-100 text-yellow-700' :
                      hazard.type === 'tree' ? 'bg-green-100 text-green-700' :
                      hazard.type === 'flood' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {getHazardIcon(hazard.type)}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold capitalize">{hazard.type.replace('_', ' ')} Hazard</CardTitle>
                      <CardDescription className="text-[10px]">{hazard.timestamp.toLocaleString()}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={hazard.status === 'verified' ? 'secondary' : 'outline'} className="text-[10px]">
                    {hazard.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700">{hazard.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Immediate Safety
                </h3>
                <ul className="space-y-2 text-sm text-slate-600 list-disc pl-5">
                  <li>Stay away from windows and glass doors.</li>
                  <li>Avoid using electrical appliances if you are wet or standing in water.</li>
                  <li>Watch out for downed power lines; report them immediately.</li>
                  <li>Do not walk or drive through floodwaters.</li>
                </ul>
              </div>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-500" />
                  Water & Food
                </h3>
                <ul className="space-y-2 text-sm text-slate-600 list-disc pl-5">
                  <li>Boil water for at least 1 minute before drinking if supply is compromised.</li>
                  <li>Discard any food that has come into contact with floodwater.</li>
                  <li>Keep the refrigerator closed as much as possible to preserve food.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
