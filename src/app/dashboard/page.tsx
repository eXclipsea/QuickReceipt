'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, Receipt, DollarSign, LogOut, TrendingUp, MapPin, Download, Store, Calendar, BarChart3, PieChart } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
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
      Category,
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-full">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">QuickReceipt</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Welcome back!</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6 border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex flex-wrap gap-2 p-2">
            {[
              { id: 'overview', label: 'Overview', icon: Receipt },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'savings', label: 'Savings', icon: Store },
              { id: 'insights', label: 'Insights', icon: PieChart },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${savedReceipts.reduce((sum, r) => sum + r.totalAmount, 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-full">
                    <DollarSign className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">This Month</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">${analytics.monthly.toFixed(2)}</p>
                  </div>
                  <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                    <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Receipts</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{savedReceipts.length}</p>
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
                    <Receipt className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Scan Receipt</h2>
              
              {/* Photo Instructions */}
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">📸 Photo Guidelines:</h3>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <p>✅ <strong>Show:</strong> Store name, address, date, items purchased, and total amount</p>
                  <p>❌ <strong>Hide:</strong> Order numbers, approval codes, and last 4 digits of cards</p>
                  <p>💡 <strong>Tip:</strong> Ensure good lighting and capture the entire receipt</p>
                </div>
              </div>
              
              <div className="text-center">
                <button
                  onClick={handleCameraCapture}
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-colors mb-4"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                  {isLoading ? 'Scanning...' : '📸 Take Photo of Receipt'}
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="w-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
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
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg transition-colors">
                    <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Receipts */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Receipts</h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">{savedReceipts.length} total</span>
              </div>
              
              {savedReceipts.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No receipts yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Upload your first receipt to get started</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {savedReceipts.slice(-10).reverse().map((receipt) => (
                    <div key={receipt.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{receipt.merchantName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{receipt.date}</p>
                          <div className="flex gap-2 mt-1">
                            <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md transition-colors">
                              {receipt.category}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg text-gray-900 dark:text-white">${receipt.totalAmount.toFixed(2)}</p>
                        </div>
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
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 transition-colors">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Spending Analytics</h2>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export to Excel
                </button>
              </div>

              {/* Time Period Analytics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Weekly</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">${analytics.weekly.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Monthly</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">${analytics.monthly.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Yearly</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">${analytics.yearly.toFixed(2)}</p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="mb-6">
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">Spending by Category</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.categoryTotals)
                    .sort(([,a], [,b]) => b - a)
                    .map(([category, total]) => {
                      const percentage = (total / savedReceipts.reduce((sum, r) => sum + r.totalAmount, 0)) * 100;
                      return (
                        <div key={category} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <span className="font-medium text-gray-900 dark:text-white">{category}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div 
                                className="bg-indigo-600 h-2 rounded-full" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white w-20 text-right">
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
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">Most Visited Stores</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(analytics.merchantCounts)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 6)
                    .map(([merchant, count]) => (
                      <div key={merchant} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <span className="font-medium text-gray-900 dark:text-white">{merchant}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{count} visits</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Savings Tab */}
        {activeTab === 'savings' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Find Better Prices</h2>

              <div className="text-center mb-6">
                <button
                  onClick={searchNearbyStores}
                  disabled={isAnalyzing}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 mx-auto transition-colors"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  {isAnalyzing ? 'Searching...' : 'Search Nearby Stores'}
                </button>
              </div>

              {/* Disclaimer */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Disclaimer:</strong> Price comparison feature is not 100% accurate as stores may not disclose all pricing information in real-time. Always verify prices at the store before making purchases.
                </p>
              </div>

              {/* Nearby Stores Results */}
              {nearbyStores.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">Nearby Store Prices</h3>
                  <div className="space-y-3">
                    {nearbyStores.map((store, index) => (
                      <div key={index} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{store.store}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{store.distance}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">${store.price.toFixed(2)}</p>
                          {index === 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400">Best Price!</p>
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
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Shopping Insights</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Category */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Top Spending Category</h3>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {Object.keys(analytics.categoryTotals)[0] || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ${Object.values(analytics.categoryTotals)[0]?.toFixed(2) || '0.00'} total
                  </p>
                </div>

                {/* Average Purchase */}
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Average Purchase</h3>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ${savedReceipts.length > 0 
                      ? (savedReceipts.reduce((sum, r) => sum + r.totalAmount, 0) / savedReceipts.length).toFixed(2)
                      : '0.00'
                    }
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Per receipt</p>
                </div>

                {/* Shopping Frequency */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Shopping Frequency</h3>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {analytics.monthly > 0 ? Math.round(analytics.monthly / (savedReceipts.reduce((sum, r) => sum + r.totalAmount, 0) / savedReceipts.length || 1)) : 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Trips per month</p>
                </div>

                {/* Budget Status */}
                <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Monthly Budget Status</h3>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ${analytics.monthly.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Spent this month</p>
                </div>
              </div>

              {/* Recommendations */}
              <div className="mt-6">
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">💡 Recommendations</h3>
                <div className="space-y-3">
                  {analytics.monthly > 500 && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Consider setting a monthly budget to manage spending in your top category: {Object.keys(analytics.categoryTotals)[0]}
                      </p>
                    </div>
                  )}
                  
                  {Object.keys(analytics.merchantCounts).length > 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 rounded">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        You shop most frequently at {Object.keys(analytics.merchantCounts)[0]}. Consider checking their loyalty program for additional savings.
                      </p>
                    </div>
                  )}

                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 rounded">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Great job tracking your receipts! Keep using the app to maximize your savings insights.
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
