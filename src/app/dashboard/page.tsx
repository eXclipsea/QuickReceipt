'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, Receipt, DollarSign, LogOut, TrendingUp, MapPin, Download, Store, Calendar, BarChart3, PieChart } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ReceiptData {
  merchantName: string;
  date: string;
  totalAmount: number;
  category: string;
  items?: string[];
  location?: string;
}

interface SavedReceipt extends ReceiptData {
  id: string;
  timestamp: string;
}

interface StorePrice {
  store: string;
  price: number;
  distance?: string;
}

type TabType = 'overview' | 'analytics' | 'savings' | 'insights';

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [savedReceipts, setSavedReceipts] = useState<SavedReceipt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [nearbyStores, setNearbyStores] = useState<StorePrice[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved receipts from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('quickReceipt_receipts');
    if (stored) {
      setSavedReceipts(JSON.parse(stored));
    }
  }, []);

  // Resize and optimize image before sending to API
  const optimizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Resize to max 1200x1200 while maintaining aspect ratio
        const maxSize = 1200;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to 0.8 quality
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Optimize image first
      const optimizedImage = await optimizeImage(file);
      
      // Convert data URL back to blob
      const response = await fetch(optimizedImage);
      const blob = await response.blob();
      const optimizedFile = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
      
      const formData = new FormData();
      formData.append('image', optimizedFile);

      const apiResponse = await fetch('/api/scan', {
        method: 'POST',
        body: formData,
      });

      if (!apiResponse.ok) {
        throw new Error('Failed to scan receipt');
      }

      const data = await apiResponse.json();
      setReceiptData(data);
      
      // Auto-save the receipt
      const newReceipt: SavedReceipt = {
        ...data,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
      };
      
      const updatedReceipts = [...savedReceipts, newReceipt];
      setSavedReceipts(updatedReceipts);
      localStorage.setItem('quickReceipt_receipts', JSON.stringify(updatedReceipts));
      
      // Reset form
      setReceiptData(null);
    } catch (err) {
      setError('Failed to scan receipt. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleCameraCapture = async () => {
    // Try to access camera directly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Create video element to show camera feed
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      
      // Create modal for camera interface
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-md w-full mx-4">
          <div class="text-center mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">📸 Scan Receipt</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Position your receipt in the frame</p>
          </div>
          <div class="relative mb-4">
            <video class="w-full rounded-lg" autoplay></video>
            <div class="absolute inset-0 border-2 border-dashed border-white rounded-lg pointer-events-none"></div>
          </div>
          <div class="flex gap-2">
            <button id="capture-btn" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg">
              📸 Capture
            </button>
            <button id="cancel-btn" class="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2 px-4 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      const videoElement = modal.querySelector('video')!;
      videoElement.srcObject = stream;
      
      // Handle capture
      const captureBtn = modal.querySelector('#capture-btn')!;
      const cancelBtn = modal.querySelector('#cancel-btn')!;
      
      captureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoElement, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
            handleImageUpload(file);
          }
        }, 'image/jpeg', 0.8);
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
      });
      
      cancelBtn.addEventListener('click', () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
      });
      
    } catch (error) {
      console.error('Camera access failed:', error);
      // Fallback to file picker if camera fails
      fileInputRef.current?.click();
    }
  };

  const handleLogout = () => {
    window.location.href = '/';
  };

  // Calculate analytics
  const calculateAnalytics = () => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const weekly = savedReceipts
      .filter(r => new Date(r.date) >= oneWeekAgo)
      .reduce((sum, r) => sum + r.totalAmount, 0);
    
    const monthly = savedReceipts
      .filter(r => new Date(r.date) >= oneMonthAgo)
      .reduce((sum, r) => sum + r.totalAmount, 0);
    
    const yearly = savedReceipts
      .filter(r => new Date(r.date) >= oneYearAgo)
      .reduce((sum, r) => sum + r.totalAmount, 0);

    // Category breakdown
    const categoryTotals = savedReceipts.reduce((acc, receipt) => {
      acc[receipt.category] = (acc[receipt.category] || 0) + receipt.totalAmount;
      return acc;
    }, {} as Record<string, number>);

    // Most frequent merchants
    const merchantCounts = savedReceipts.reduce((acc, receipt) => {
      acc[receipt.merchantName] = (acc[receipt.merchantName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { weekly, monthly, yearly, categoryTotals, merchantCounts };
  };

  // Export to Excel
  const exportToExcel = () => {
    const analytics = calculateAnalytics();
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Receipts sheet
    const receiptsData = savedReceipts.map(r => ({
      Date: r.date,
      Merchant: r.merchantName,
      Category: r.category,
      Amount: r.totalAmount
    }));
    const receiptsWS = XLSX.utils.json_to_sheet(receiptsData);
    XLSX.utils.book_append_sheet(wb, receiptsWS, 'Receipts');
    
    // Analytics sheet
    const analyticsData = [
      { Period: 'Weekly', Total: analytics.weekly },
      { Period: 'Monthly', Total: analytics.monthly },
      { Period: 'Yearly', Total: analytics.yearly }
    ];
    const analyticsWS = XLSX.utils.json_to_sheet(analyticsData);
    XLSX.utils.book_append_sheet(wb, analyticsWS, 'Analytics');
    
    // Categories sheet
    const categoriesData = Object.entries(analytics.categoryTotals).map(([category, total]) => ({
      Category: category,
      Total: total
    }));
    const categoriesWS = XLSX.utils.json_to_sheet(categoriesData);
    XLSX.utils.book_append_sheet(wb, categoriesWS, 'Categories');
    
    // Save file
    XLSX.writeFile(wb, `QuickReceipt_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Simulate nearby stores search (you can replace this with real API)
  const searchNearbyStores = async () => {
    setIsAnalyzing(true);
    try {
      // Simulate API call - replace with real store API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock data - replace with real API response
      const mockStores: StorePrice[] = [
        { store: 'Walmart', price: 45.99, distance: '0.5 mi' },
        { store: 'Target', price: 47.50, distance: '0.8 mi' },
        { store: 'Costco', price: 42.99, distance: '1.2 mi' },
      ];
      
      setNearbyStores(mockStores);
    } catch (error) {
      console.error('Error searching stores:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analytics = calculateAnalytics();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-cyan-400" />
            <h1 className="text-lg font-semibold tracking-tight">QuickReceipt</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 border-b border-neutral-800">
          {[
            { id: 'overview', label: 'Overview', icon: Receipt },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'savings', label: 'Savings', icon: Store },
            { id: 'insights', label: 'Insights', icon: PieChart },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-neutral-800 p-4">
                <p className="text-xs text-neutral-500 mb-1">Total Spent</p>
                <p className="text-xl font-semibold text-cyan-400">
                  ${savedReceipts.reduce((sum, r) => sum + r.totalAmount, 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-800 p-4">
                <p className="text-xs text-neutral-500 mb-1">This Month</p>
                <p className="text-xl font-semibold">${analytics.monthly.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-neutral-800 p-4">
                <p className="text-xs text-neutral-500 mb-1">Total Receipts</p>
                <p className="text-xl font-semibold">{savedReceipts.length}</p>
              </div>
            </div>

            {/* Upload Section */}
            <div className="rounded-xl border border-neutral-800 p-6">
              <h2 className="text-sm font-medium mb-4">Scan Receipt</h2>
              
              <div className="mb-4 p-3 rounded-lg border border-neutral-800">
                <p className="text-xs text-neutral-500">Show store name, date, items, and total. Ensure good lighting.</p>
              </div>
              
              <div>
                <button
                  onClick={handleCameraCapture}
                  disabled={isLoading}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-medium py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors mb-3 text-sm"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {isLoading ? 'Scanning...' : 'Take Photo of Receipt'}
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="w-full border border-neutral-800 hover:bg-neutral-900 text-neutral-400 font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Choose from Gallery
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {error && (
                  <div className="mt-3 p-3 rounded-lg border border-red-400/20">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Receipts */}
            <div className="rounded-xl border border-neutral-800 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-medium">Recent Receipts</h2>
                <span className="text-xs text-neutral-500">{savedReceipts.length} total</span>
              </div>
              
              {savedReceipts.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                  <p className="text-neutral-500 text-sm">No receipts yet</p>
                  <p className="text-xs text-neutral-600 mt-1">Upload your first receipt to get started</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {savedReceipts.slice(-10).reverse().map((receipt) => (
                    <div key={receipt.id} className="rounded-lg border border-neutral-800 p-3 hover:bg-neutral-950 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{receipt.merchantName}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{receipt.date}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 border border-neutral-800 text-neutral-500 text-xs rounded">
                            {receipt.category}
                          </span>
                        </div>
                        <p className="font-medium text-sm">${receipt.totalAmount.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-neutral-800 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-medium">Spending Analytics</h2>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg transition-colors text-xs font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>

              {/* Time Period Analytics */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="text-center p-4 rounded-lg border border-neutral-800">
                  <p className="text-xs text-neutral-500 mb-1">Weekly</p>
                  <p className="text-lg font-semibold text-cyan-400">${analytics.weekly.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 rounded-lg border border-neutral-800">
                  <p className="text-xs text-neutral-500 mb-1">Monthly</p>
                  <p className="text-lg font-semibold">${analytics.monthly.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 rounded-lg border border-neutral-800">
                  <p className="text-xs text-neutral-500 mb-1">Yearly</p>
                  <p className="text-lg font-semibold">${analytics.yearly.toFixed(2)}</p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-neutral-500 mb-3">Spending by Category</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.categoryTotals)
                    .sort(([,a], [,b]) => b - a)
                    .map(([category, total]) => {
                      const percentage = (total / savedReceipts.reduce((sum, r) => sum + r.totalAmount, 0)) * 100;
                      return (
                        <div key={category} className="flex items-center justify-between p-3 rounded-lg border border-neutral-800">
                          <span className="text-sm">{category}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-20 bg-neutral-800 rounded-full h-1.5">
                              <div 
                                className="bg-cyan-400 h-1.5 rounded-full" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-16 text-right">
                              ${total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Top Merchants */}
              <div>
                <h3 className="text-xs font-medium text-neutral-500 mb-3">Most Visited Stores</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(analytics.merchantCounts)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 6)
                    .map(([merchant, count]) => (
                      <div key={merchant} className="flex justify-between items-center p-3 rounded-lg border border-neutral-800">
                        <span className="text-sm">{merchant}</span>
                        <span className="text-xs text-neutral-500">{count} visits</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Savings Tab */}
        {activeTab === 'savings' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-neutral-800 p-6">
              <h2 className="text-sm font-medium mb-4">Find Better Prices</h2>

              <div className="text-center mb-6">
                <button
                  onClick={searchNearbyStores}
                  disabled={isAnalyzing}
                  className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-medium py-2.5 px-5 rounded-lg flex items-center justify-center gap-2 mx-auto transition-colors text-sm"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  {isAnalyzing ? 'Searching...' : 'Search Nearby Stores'}
                </button>
              </div>

              <div className="mb-6 p-3 rounded-lg border border-neutral-800">
                <p className="text-xs text-neutral-500">
                  Price comparison is approximate. Always verify prices at the store.
                </p>
              </div>

              {nearbyStores.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-neutral-500 mb-3">Nearby Store Prices</h3>
                  <div className="space-y-2">
                    {nearbyStores.map((store, index) => (
                      <div key={index} className="flex justify-between items-center p-4 rounded-lg border border-neutral-800">
                        <div>
                          <p className="text-sm font-medium">{store.store}</p>
                          <p className="text-xs text-neutral-500">{store.distance}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-cyan-400">${store.price.toFixed(2)}</p>
                          {index === 0 && (
                            <p className="text-xs text-cyan-400">Best Price</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-neutral-800 p-6">
              <h2 className="text-sm font-medium mb-4">Shopping Insights</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg border border-neutral-800">
                  <h3 className="text-xs text-neutral-500 mb-1">Top Spending Category</h3>
                  <p className="font-medium">
                    {Object.keys(analytics.categoryTotals)[0] || 'N/A'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    ${Object.values(analytics.categoryTotals)[0]?.toFixed(2) || '0.00'} total
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-neutral-800">
                  <h3 className="text-xs text-neutral-500 mb-1">Average Purchase</h3>
                  <p className="font-medium">
                    ${savedReceipts.length > 0 
                      ? (savedReceipts.reduce((sum, r) => sum + r.totalAmount, 0) / savedReceipts.length).toFixed(2)
                      : '0.00'
                    }
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">Per receipt</p>
                </div>

                <div className="p-4 rounded-lg border border-neutral-800">
                  <h3 className="text-xs text-neutral-500 mb-1">Shopping Frequency</h3>
                  <p className="font-medium">
                    {analytics.monthly > 0 ? Math.round(analytics.monthly / (savedReceipts.reduce((sum, r) => sum + r.totalAmount, 0) / savedReceipts.length || 1)) : 0}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">Trips per month</p>
                </div>

                <div className="p-4 rounded-lg border border-neutral-800">
                  <h3 className="text-xs text-neutral-500 mb-1">Monthly Budget Status</h3>
                  <p className="font-medium">
                    ${analytics.monthly.toFixed(2)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">Spent this month</p>
                </div>
              </div>

              {/* Recommendations */}
              <div className="mt-6">
                <h3 className="text-xs font-medium text-neutral-500 mb-3">Recommendations</h3>
                <div className="space-y-2">
                  {analytics.monthly > 500 && (
                    <div className="p-3 rounded-lg border border-orange-400/20">
                      <p className="text-sm text-neutral-400">
                        Consider setting a monthly budget for: {Object.keys(analytics.categoryTotals)[0]}
                      </p>
                    </div>
                  )}
                  
                  {Object.keys(analytics.merchantCounts).length > 0 && (
                    <div className="p-3 rounded-lg border border-cyan-400/20">
                      <p className="text-sm text-neutral-400">
                        You shop most at {Object.keys(analytics.merchantCounts)[0]}. Check their loyalty program.
                      </p>
                    </div>
                  )}

                  <div className="p-3 rounded-lg border border-green-400/20">
                    <p className="text-sm text-neutral-400">
                      Keep tracking receipts to maximize savings insights.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
