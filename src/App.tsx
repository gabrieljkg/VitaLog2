import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  ShoppingCart, 
  Plus, 
  Search,
  Calendar,
  ChevronRight,
  RefreshCw,
  BrainCircuit,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  CreditCard,
  History,
  PieChart,
  Trash2,
  CheckCircle2,
  X,
  Pencil,
  FileText,
  Upload,
  Link,
  FileCode,
  Printer,
  LogOut,
  ClipboardList,
  Save,
  Scale,
  Settings as SettingsIcon,
  Tag,
  Barcode,
  User
} from 'lucide-react';
import BarcodeComponent from 'react-barcode';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { Product, Sale, AIInsight, XMLProduct, CashRegister } from './types';
import { getAIInsights } from './services/geminiService';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import QRCode from 'react-qr-code';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>('loading');
  const [reportFilter, setReportFilter] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
  const [reportUserFilter, setReportUserFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'pos' | 'reports' | 'ai' | 'xml' | 'audit' | 'settings' | 'labels'>('dashboard');
  
  // Label Printing State
  const [labelQueue, setLabelQueue] = useState<{product: Product, quantity: number}[]>([]);
  const [labelSize, setLabelSize] = useState<'40x40' | '60x40' | 'pimaco'>('40x40');
  const [isPrintingLabels, setIsPrintingLabels] = useState(false);
  const [storeSettings, setStoreSettings] = useState({
    name: 'NOME DO ESTABELECIMENTO',
    document: 'CNPJ: 00.000.000/0001-00',
    ie: '',
    address: 'Rua Exemplo, 123 - Centro',
    phone: '(00) 0000-0000',
    message: 'Obrigado pela preferência!\nVolte sempre!'
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<{product: Product, quantity: number, discountPercentage?: number}[]>([]);
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [xmlProducts, setXmlProducts] = useState<XMLProduct[]>([]);
  const [isParsingXml, setIsParsingXml] = useState(false);
  const [posSearch, setPosSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [expiring, setExpiring] = useState<Product[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [auditCounts, setAuditCounts] = useState<Record<number, number>>({});
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [selectedProductForWeight, setSelectedProductForWeight] = useState<Product | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerInitialBalance, setRegisterInitialBalance] = useState(0);
  const [registerFinalBalance, setRegisterFinalBalance] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'misto'>('dinheiro');
  const [mixedCashAmount, setMixedCashAmount] = useState<number>(0);
  const [mixedCardAmount, setMixedCardAmount] = useState<number>(0);
  const [mixedCardMethod, setMixedCardMethod] = useState<'cartao_credito' | 'cartao_debito' | 'pix'>('cartao_credito');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [currentLojaId, setCurrentLojaId] = useState<string | number | null>(null);
  const [registerSalesCash, setRegisterSalesCash] = useState<number>(0);
  const [registerSalesOther, setRegisterSalesOther] = useState<number>(0);
  const [isFetchingRegisterSales, setIsFetchingRegisterSales] = useState(false);
  const [closedRegisterSummary, setClosedRegisterSummary] = useState<{
    initialBalance: number;
    salesMoney: number;
    salesOther: number;
    expectedBalance: number;
    finalBalance: number;
    difference: number;
    closedAt: string;
  } | null>(null);
  const [receiptData, setReceiptData] = useState<{
    items: { product: Product, quantity: number, discountPercentage?: number }[],
    subtotal?: number,
    discount?: number,
    total: number,
    paymentMethod: string,
    amountReceived?: number,
    change?: number,
    date: string
  } | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    barcode: '',
    current_stock: 0,
    min_stock: 5,
    price: 0,
    unit: 'un' as 'un' | 'kg',
    expiry_date: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setError("Configuração pendente: Por favor, adicione as chaves VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente (Secrets) para conectar ao seu banco de dados.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch Products
      const { data: pData, error: pError } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: false });
      
      if (pError) {
        console.error("Products fetch error:", pError);
        if (pError.code === '42P01') {
          setError("Tabela 'products' não encontrada. Certifique-se de criar a tabela no SQL Editor do Supabase.");
        } else if (pError.code === 'PGRST301') {
          setError("Erro de permissão (RLS). Desabilite o RLS ou adicione uma política de acesso público no Supabase.");
        } else {
          setError(`Erro ao carregar produtos: ${pError.message}`);
        }
        setLoading(false);
        return;
      }

      setProducts(pData || []);

      // Fetch Sales (Optional - don't block if it fails)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let lojaIdToUse = currentLojaId;
        if (!lojaIdToUse && sessionData?.session?.user?.id) {
          const { data: loja } = await supabase.from('lojas').select('id').eq('user_id', sessionData.session.user.id).maybeSingle();
          if (loja) lojaIdToUse = loja.id;
        }

        let query = supabase.from('sales').select('*').order('sale_date', { ascending: false });
        if (lojaIdToUse) {
          query = query.eq('loja_id', lojaIdToUse);
        }

        const { data: sData, error: sError } = await query;

        if (!sError && sData) {
          const formattedSales = sData.map(s => {
            const product = pData?.find(p => p.id === s.product_id);
            return {
              ...s,
              product_name: product ? product.name : 'Produto Removido'
            };
          });
          setSales(formattedSales);
        } else if (sError && sError.code !== '42P01') {
          console.warn("Sales fetch error:", sError);
        }
      } catch (sErr) {
        console.warn("Sales fetch exception:", sErr);
      }

      // Fetch Cash Register
      try {
        const { data: rData, error: rError } = await supabase
          .from('cash_registers')
          .select('*')
          .order('opened_at', { ascending: false });
        
        if (!rError && rData) {
          setCashRegisters(rData as CashRegister[]);
          const openReg = rData.find(r => r.status === 'open');
          setCurrentRegister(openReg ? (openReg as CashRegister) : null);
        }
      } catch (rErr) {
        console.warn("Cash register fetch exception:", rErr);
      }

      // Calculate Insights locally from fetched data
      const pDataSafe = pData || [];
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const nextMonthStr = nextMonth.toISOString().split('T')[0];

      const expiringProducts = pDataSafe.filter(p => p.expiry_date && p.expiry_date <= nextMonthStr);
      const lowStockProducts = pDataSafe.filter(p => p.current_stock <= p.min_stock);

      setExpiring(expiringProducts);
      setLowStock(lowStockProducts);
    } catch (err) {
      console.error("Supabase General Fetch error:", err);
      setError("Erro de conexão com o Supabase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const loadSettings = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('store_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (data) {
          setStoreSettings(prev => ({ 
             ...prev, 
             name: data.name || prev.name,
             document: data.document || prev.document,
             ie: data.ie || prev.ie,
             address: data.address || prev.address,
             phone: data.phone || prev.phone,
             message: data.message || prev.message
          }));
        } else {
          // Fallback se não existir no DB ainda tenta o LocalStorage
          const savedSettings = localStorage.getItem('storeSettings');
          if (savedSettings) {
            try {
              const parsed = JSON.parse(savedSettings);
              setStoreSettings(prev => ({ 
                ...prev, 
                name: parsed.name || prev.name,
                document: parsed.document || prev.document,
                ie: parsed.ie || prev.ie,
                address: parsed.address || prev.address,
                phone: parsed.phone || prev.phone,
                message: parsed.message || prev.message
              }));
            } catch (e) {
              console.error('Error parsing store settings', e);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao ler store_settings:", err);
      }
    };

    const loadLoja = async (userId: string) => {
      try {
        const { data, error } = await supabase.from('lojas').select('id').eq('user_id', userId).maybeSingle();
        if (data && !error) {
          setCurrentLojaId(data.id);
        }
      } catch (err) {
        console.error('Erro ao ler loja_id:', err);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        loadSettings(session.user.id);
        loadLoja(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let channel: any;
    if (session) {
      fetchData();
      checkPaymentStatus(session.user.id);

      channel = supabase
        .channel('public:sales')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sales', filter: currentLojaId ? `loja_id=eq.${currentLojaId}` : undefined },
          () => {
            fetchData();
          }
        )
        .subscribe();
    } else {
      setPaymentStatus('loading');
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session, currentLojaId]);

  const checkPaymentStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('status_pagamento')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error("Error fetching profile:", error);
        setPaymentStatus('pending');
      } else {
        setPaymentStatus(data.status_pagamento || 'pending');
      }
    } catch (err) {
      console.error("Error checking payment status:", err);
      setPaymentStatus('pending');
    }
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const generateAIInsights = async () => {
    setAiLoading(true);
    try {
      const insights = await getAIInsights(products, sales);
      setAiInsights(insights);
      setActiveTab('ai');
    } catch (err) {
      console.error("AI Error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setError("Erro: Chaves do Supabase não configuradas. Verifique as variáveis de ambiente.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      // Ensure numeric fields are numbers
      const productData = {
        name: newProduct.name.trim(),
        category: newProduct.category.trim(),
        barcode: newProduct.barcode.trim().toUpperCase(),
        current_stock: Number(newProduct.current_stock),
        min_stock: Number(newProduct.min_stock),
        price: Number(newProduct.price),
        unit: newProduct.unit,
        expiry_date: newProduct.expiry_date
      };

      if (!productData.name || !productData.barcode) {
        throw new Error("Nome e Código de Barras são obrigatórios.");
      }

      if (editingProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        
        if (updateError) throw updateError;
        setSuccessMessage("Produto atualizado com sucesso!");
      } else {
        const { error: insertError } = await supabase
          .from('products')
          .insert([productData]);
        
        if (insertError) throw insertError;
        setSuccessMessage("Produto adicionado com sucesso!");
      }

      setIsModalOpen(false);
      setEditingProduct(null);
      setNewProduct({
        name: '',
        category: '',
        barcode: '',
        current_stock: 0,
        min_stock: 5,
        price: 0,
        unit: 'un' as 'un' | 'kg',
        expiry_date: new Date().toISOString().split('T')[0]
      });
      await fetchData();
    } catch (err: any) {
      console.error("Supabase Save product error details:", err);
      if (err.code === '23505') {
        setError("Erro: Já existe um produto com este SKU.");
      } else if (err.code === '42P01') {
        setError("Erro: Tabela 'products' não encontrada. Crie-a no SQL Editor do Supabase.");
      } else if (err.code === 'PGRST301') {
        setError("Erro de permissão: RLS está ativado. Desabilite o RLS nas configurações da tabela no Supabase.");
      } else {
        setError(`Erro ao salvar: ${err.message || 'Erro desconhecido'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      category: product.category,
      barcode: product.barcode || '',
      current_stock: product.current_stock,
      min_stock: product.min_stock,
      price: product.price,
      unit: product.unit || 'un',
      expiry_date: product.expiry_date
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setNewProduct({
      name: '',
      category: '',
      barcode: '',
      current_stock: 0,
      min_stock: 5,
      price: 0,
      expiry_date: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingXml(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const xmlText = event.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        // NFe structure: det -> prod
        const details = xmlDoc.getElementsByTagName("det");
        const parsedProducts: XMLProduct[] = [];

        for (let i = 0; i < details.length; i++) {
          const prod = details[i].getElementsByTagName("prod")[0];
          if (prod) {
            const name = prod.getElementsByTagName("xProd")[0]?.textContent || "";
            const cEAN = prod.getElementsByTagName("cEAN")[0]?.textContent || "";
            const cProd = prod.getElementsByTagName("cProd")[0]?.textContent || "";
            const barcode = (cEAN && cEAN !== "SEM GTIN") ? cEAN : cProd;
            const quantity = parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || "0");
            const price = parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || "0");
            
            // Try to match with existing product by barcode
            let matched = products.find(p => p.barcode && p.barcode === barcode);
            if (!matched) {
              matched = products.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim() || (p.barcode && p.barcode === cProd));
            }

            parsedProducts.push({
              name,
              barcode,
              quantity,
              price,
              matchedProductId: matched?.id
            });
          }
        }

        if (parsedProducts.length === 0) {
          setError("Nenhum produto encontrado no XML. Verifique se é uma NFe válida.");
        } else {
          setXmlProducts(parsedProducts);
          setSuccessMessage(`${parsedProducts.length} produtos encontrados na nota.`);
        }
      } catch (err) {
        console.error("XML Parse Error:", err);
        setError("Erro ao processar arquivo XML. Verifique se é uma NFe válida.");
      } finally {
        setIsParsingXml(false);
      }
    };
    reader.readAsText(file);
  };

  const syncXmlToStock = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updates = xmlProducts.filter(p => p.matchedProductId);
      if (updates.length === 0) {
        throw new Error("Nenhum produto vinculado encontrado para atualizar.");
      }

      for (const xmlP of updates) {
        const existingProduct = products.find(p => p.id === xmlP.matchedProductId);
        if (existingProduct) {
          const newStock = existingProduct.current_stock + xmlP.quantity;
          
          const { error: updateError } = await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', existingProduct.id);
          
          if (updateError) throw updateError;
        }
      }

      setSuccessMessage("Estoque atualizado com sucesso!");
      setXmlProducts([]);
      await fetchData();
    } catch (err: any) {
      console.error("Sync Error:", err);
      setError(`Erro ao sincronizar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      // First, delete all sales associated with this product
      const { error: salesDeleteError } = await supabase
        .from('sales')
        .delete()
        .eq('product_id', productId);

      if (salesDeleteError) {
        console.warn("Erro ao excluir vendas vinculadas:", salesDeleteError);
        // We continue anyway, or we could throw. 
        // If the user wants automatic deletion, we should ensure this succeeds or handle it.
      }

      // Then delete the product
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (deleteError) throw deleteError;

      setSuccessMessage("Produto e vendas vinculadas excluídos com sucesso!");
      await fetchData();
    } catch (err: any) {
      console.error("Delete Error:", err);
      setError(`Erro ao excluir: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
      setProductToDelete(null);
    }
  };

  const addToCart = (product: Product) => {
    if (product.current_stock <= 0) {
      setError("Produto sem estoque!");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (product.unit === 'kg') {
      setSelectedProductForWeight(product);
      setWeightInput('');
      setIsWeightModalOpen(true);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock) {
          setError("Quantidade máxima em estoque atingida!");
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1, discountPercentage: 0 }];
    });
  };

  const handleWeightSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForWeight) return;

    const weight = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(weight) || weight <= 0) {
      setError("Peso inválido!");
      return;
    }

    if (weight > selectedProductForWeight.current_stock) {
      setError("Peso superior ao estoque disponível!");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === selectedProductForWeight.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === selectedProductForWeight.id 
            ? { ...item, quantity: item.quantity + weight } 
            : item
        );
      }
      return [...prev, { product: selectedProductForWeight, quantity: weight, discountPercentage: 0 }];
    });

    setIsWeightModalOpen(false);
    setSelectedProductForWeight(null);
    setWeightInput('');
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.product.current_stock) {
          setError("Estoque insuficiente!");
          setTimeout(() => setError(null), 3000);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateCartItemDiscount = (productId: number, discount: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, discountPercentage: Math.min(100, Math.max(0, discount)) };
      }
      return item;
    }));
  };

  const openRegisterModal = async () => {
    setIsRegisterModalOpen(true);
    if (currentRegister) {
      setIsFetchingRegisterSales(true);
      try {
        const { data, error } = await supabase
          .from('sales')
          .select('total_price, payment_method, valor_dinheiro, valor_cartao, valor_pix')
          .eq('cash_register_id', currentRegister.id);
          
        if (error) throw error;
        
        let cash = 0;
        let other = 0;
        if (data && data.length > 0) {
          data.forEach(s => {
            const saleCash = (s.valor_dinheiro !== null && s.valor_dinheiro !== undefined) ? s.valor_dinheiro : (s.payment_method === 'dinheiro' ? s.total_price : 0);
            const saleOther = (s.valor_cartao !== null && s.valor_pix !== null && s.valor_cartao !== undefined && s.valor_pix !== undefined) ? ((s.valor_cartao || 0) + (s.valor_pix || 0)) : (s.payment_method !== 'dinheiro' ? s.total_price : 0);
            cash += saleCash;
            other += saleOther;
          });
        } else {
          // Fallback to local state if Supabase delay
          const localRegisterSales = sales.filter(s => String(s.cash_register_id) === String(currentRegister.id));
          localRegisterSales.forEach(s => {
            const saleCash = (s.valor_dinheiro !== undefined) ? (s.valor_dinheiro || 0) : (s.payment_method === 'dinheiro' ? s.total_price : 0);
            const saleOther = (s.valor_cartao !== undefined && s.valor_pix !== undefined) ? ((s.valor_cartao || 0) + (s.valor_pix || 0)) : (s.payment_method !== 'dinheiro' ? s.total_price : 0);
            cash += saleCash;
            other += saleOther;
          });
        }
        setRegisterSalesCash(cash);
        setRegisterSalesOther(other);
      } catch (err) {
        console.error("Error fetching register sales:", err);
      } finally {
        setIsFetchingRegisterSales(false);
      }
    }
  };

  const openRegister = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .insert([{
          initial_balance: registerInitialBalance,
          status: 'open'
        }])
        .select()
        .single();
      
      if (error) throw error;
      setCurrentRegister(data as CashRegister);
      setIsRegisterModalOpen(false);
      setSuccessMessage("Caixa aberto com sucesso!");
    } catch (err: any) {
      console.error("Error opening register:", err);
      setError(`Erro ao abrir caixa: ${err.message}`);
    }
  };

  const closeRegister = async () => {
    if (!currentRegister) return;
    try {
      const { error } = await supabase
        .from('cash_registers')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          final_balance: registerFinalBalance
        })
        .eq('id', currentRegister.id);
      
      if (error) throw error;

      const salesMoney = registerSalesCash;
      const salesOther = registerSalesOther;
      const expectedBalance = currentRegister.initial_balance + salesMoney;
      const difference = registerFinalBalance - expectedBalance;

      setClosedRegisterSummary({
        initialBalance: currentRegister.initial_balance,
        salesMoney,
        salesOther,
        expectedBalance,
        finalBalance: registerFinalBalance,
        difference,
        closedAt: new Date().toISOString()
      });

      setCurrentRegister(null);
      setIsRegisterModalOpen(false);
      setSuccessMessage("Caixa fechado com sucesso!");
    } catch (err: any) {
      console.error("Error closing register:", err);
      setError(`Erro ao fechar caixa: ${err.message}`);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError("Adicione itens ao carrinho primeiro.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    if (selectedPaymentMethod === 'dinheiro') {
      if (amountReceived < cartTotal - 0.01) {
        setError(`O valor recebido (R$ ${amountReceived.toFixed(2)}) não pode ser menor que o total da venda (R$ ${cartTotal.toFixed(2)}).`);
        setTimeout(() => setError(null), 5000);
        return;
      }
    }

    if (selectedPaymentMethod === 'misto') {
      const totalMixed = mixedCashAmount + mixedCardAmount;
      if (Math.abs(totalMixed - cartTotal) > 0.01) {
        setError(`A soma dos valores (R$ ${totalMixed.toFixed(2)}) deve ser igual ao total da venda (R$ ${cartTotal.toFixed(2)}).`);
        setTimeout(() => setError(null), 5000);
        return;
      }
      if (amountReceived < mixedCashAmount - 0.01) {
        setError(`O valor recebido em dinheiro (R$ ${amountReceived.toFixed(2)}) não pode ser menor que a parte em dinheiro da venda (R$ ${mixedCashAmount.toFixed(2)}).`);
        setTimeout(() => setError(null), 5000);
        return;
      }
    }

    setIsProcessingSale(true);
    setError(null);

    try {
      let remainingCash = selectedPaymentMethod === 'misto' ? mixedCashAmount : 0;
      let remainingCard = selectedPaymentMethod === 'misto' ? mixedCardAmount : 0;

      // Process each item
      for (const item of cart) {
        // 1. Double check stock
        const { data: currentProd, error: fetchError } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.product.id)
          .maybeSingle();
        
        if (fetchError) throw fetchError;
        
        if (!currentProd || currentProd.current_stock < item.quantity) {
          throw new Error(`Estoque insuficiente para ${item.product.name}. Disponível: ${currentProd?.current_stock || 0}`);
        }

        const itemTotal = item.product.price * item.quantity * (1 - (item.discountPercentage || 0) / 100);
        const discountFactor = cartSubtotal > 0 ? cartTotal / cartSubtotal : 1;
        const discountedItemTotal = itemTotal * discountFactor;

        // 2. Create Sale Record
        if (selectedPaymentMethod === 'misto') {
          if (remainingCash >= discountedItemTotal - 0.001) {
            // Full cash
            const { error: saleError } = await supabase.from('sales').insert([{
              product_id: item.product.id,
              barcode: String(item.product.barcode),
              quantity: item.quantity,
              total_price: discountedItemTotal,
              sale_date: new Date().toISOString(),
              payment_method: 'dinheiro',
              cash_register_id: currentRegister?.id || null,
              loja_id: currentLojaId || null,
              user_id: session?.user?.id || null,
              user_name: session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.email || 'Desconhecido',
              valor_dinheiro: discountedItemTotal,
              valor_cartao: 0,
              valor_pix: 0
            }]);
            if (saleError) throw saleError;
            remainingCash -= discountedItemTotal;
          } else if (remainingCash > 0.001) {
            // Split
            const cashPart = remainingCash;
            const cardPart = discountedItemTotal - cashPart;
            const cashQty = item.quantity * (cashPart / discountedItemTotal);
            const cardQty = item.quantity * (cardPart / discountedItemTotal);

            const { error: saleError1 } = await supabase.from('sales').insert([{
              product_id: item.product.id,
              barcode: String(item.product.barcode),
              quantity: cashQty,
              total_price: cashPart,
              sale_date: new Date().toISOString(),
              payment_method: 'dinheiro',
              cash_register_id: currentRegister?.id || null,
              loja_id: currentLojaId || null,
              user_id: session?.user?.id || null,
              user_name: session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.email || 'Desconhecido',
              valor_dinheiro: cashPart,
              valor_cartao: 0,
              valor_pix: 0
            }]);
            if (saleError1) throw saleError1;

            const { error: saleError2 } = await supabase.from('sales').insert([{
              product_id: item.product.id,
              barcode: String(item.product.barcode),
              quantity: cardQty,
              total_price: cardPart,
              sale_date: new Date().toISOString(),
              payment_method: mixedCardMethod,
              cash_register_id: currentRegister?.id || null,
              loja_id: currentLojaId || null,
              user_id: session?.user?.id || null,
              user_name: session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.email || 'Desconhecido',
              valor_dinheiro: 0,
              valor_cartao: (mixedCardMethod === 'cartao_credito' || mixedCardMethod === 'cartao_debito') ? cardPart : 0,
              valor_pix: mixedCardMethod === 'pix' ? cardPart : 0
            }]);
            if (saleError2) throw saleError2;

            remainingCash = 0;
            remainingCard -= cardPart;
          } else {
            // Full card
            const { error: saleError } = await supabase.from('sales').insert([{
              product_id: item.product.id,
              barcode: String(item.product.barcode),
              quantity: item.quantity,
              total_price: discountedItemTotal,
              sale_date: new Date().toISOString(),
              payment_method: mixedCardMethod,
              cash_register_id: currentRegister?.id || null,
              loja_id: currentLojaId || null,
              user_id: session?.user?.id || null,
              user_name: session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.email || 'Desconhecido',
              valor_dinheiro: 0,
              valor_cartao: (mixedCardMethod === 'cartao_credito' || mixedCardMethod === 'cartao_debito') ? discountedItemTotal : 0,
              valor_pix: mixedCardMethod === 'pix' ? discountedItemTotal : 0
            }]);
            if (saleError) throw saleError;
            remainingCard -= discountedItemTotal;
          }
        } else {
          const { error: saleError } = await supabase
            .from('sales')
            .insert([{
              product_id: item.product.id,
              barcode: String(item.product.barcode),
              quantity: item.quantity,
              total_price: discountedItemTotal,
              sale_date: new Date().toISOString(),
              payment_method: selectedPaymentMethod,
              cash_register_id: currentRegister?.id || null,
              loja_id: currentLojaId || null,
              user_id: session?.user?.id || null,
              user_name: session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.email || 'Desconhecido',
              valor_dinheiro: selectedPaymentMethod === 'dinheiro' ? discountedItemTotal : 0,
              valor_cartao: (selectedPaymentMethod === 'cartao_credito' || selectedPaymentMethod === 'cartao_debito') ? discountedItemTotal : 0,
              valor_pix: selectedPaymentMethod === 'pix' ? discountedItemTotal : 0
            }]);

          if (saleError) throw saleError;
        }

        // 3. Update Product Stock
        const { error: stockError } = await supabase
          .from('products')
          .update({ current_stock: currentProd.current_stock - item.quantity })
          .eq('id', item.product.id);

        if (stockError) throw stockError;
      }

      let change = 0;
      if (selectedPaymentMethod === 'dinheiro') {
        change = Math.max(0, amountReceived - cartTotal);
      } else if (selectedPaymentMethod === 'misto') {
        change = Math.max(0, amountReceived - mixedCashAmount);
      }

      setReceiptData({
        items: [...cart],
        subtotal: cartSubtotal,
        discount: cartDiscount,
        total: cartTotal,
        paymentMethod: selectedPaymentMethod === 'misto' ? `Misto (Dinheiro + ${mixedCardMethod.replace('_', ' ')})` : selectedPaymentMethod,
        amountReceived: (selectedPaymentMethod === 'dinheiro' || selectedPaymentMethod === 'misto') ? amountReceived : undefined,
        change: (selectedPaymentMethod === 'dinheiro' || selectedPaymentMethod === 'misto') ? change : undefined,
        date: new Date().toISOString()
      });
      setCart([]);
      setCartDiscount(0);
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(true);
      setSuccessMessage("Venda realizada com sucesso!");
      await fetchData();
      
      // Abre a janela de impressão do comprovante imediatamente
      setTimeout(() => {
        handlePrintReceipt();
      }, 500);
    } catch (err: any) {
      console.error("Checkout error details:", err);
      if (err.code === 'PGRST301') {
        setError("Erro de permissão: Row Level Security (RLS) está ativado no Supabase sem políticas. Desabilite o RLS para testar.");
      } else if (err.code === '42P01') {
        setError("Erro: Tabela 'sales' não encontrada no seu Supabase.");
      } else {
        setError(`Erro ao finalizar venda: ${err.message || 'Erro desconhecido'}`);
      }
    } finally {
      setIsProcessingSale(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const addToLabelQueue = (product: Product) => {
    setLabelQueue(prev => {
      const existing = prev.find(p => p.product.id === product.id);
      if (existing) {
        return prev.map(p => p.product.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromLabelQueue = (productId: string | number) => {
    setLabelQueue(prev => prev.filter(p => p.product.id !== productId));
  };

  const updateLabelQuantity = (productId: string | number, qty: number) => {
    if (qty <= 0) {
      removeFromLabelQueue(productId);
      return;
    }
    setLabelQueue(prev => prev.map(p => p.product.id === productId ? { ...p, quantity: qty } : p));
  };

  const handlePrintLabels = () => {
    setIsPrintingLabels(true);
    setTimeout(() => {
      window.print();
      setIsPrintingLabels(false);
    }, 500);
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity * (1 - (item.discountPercentage || 0) / 100)), 0);
  const cartTotal = Math.max(0, cartSubtotal - cartDiscount);
  
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredProductsForPOS = products.filter(p => 
    p.name.toLowerCase().includes(posSearch.toLowerCase()) || 
    (p.barcode && p.barcode.toLowerCase().includes(posSearch.toLowerCase()))
  );

  const getBrazilDateParts = (date: Date) => {
    return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
  };

  const filteredSalesForReport = useMemo(() => {
    const todayStr = getBrazilDateParts(new Date());
    const thisMonthStr = todayStr.substring(0, 7);
    const thisYearStr = todayStr.substring(0, 4);
    
    return sales.filter(sale => {
      if (reportUserFilter !== 'all') {
        if (reportUserFilter === 'unknown' && sale.user_id) return false;
        if (reportUserFilter !== 'unknown' && sale.user_id !== reportUserFilter) return false;
      }
      const saleDateStr = getBrazilDateParts(new Date(sale.sale_date));
      switch (reportFilter) {
        case 'today':
          return saleDateStr === todayStr;
        case 'week':
          // Approx week: just use last 7 days from now
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const weekAgoStr = getBrazilDateParts(weekAgo);
          return saleDateStr >= weekAgoStr && saleDateStr <= todayStr;
        case 'month':
          return saleDateStr.startsWith(thisMonthStr);
        case 'year':
          return saleDateStr.startsWith(thisYearStr);
        case 'all':
        default:
          return true;
      }
    });
  }, [sales, reportFilter]);

  const filteredCashRegistersForReport = useMemo(() => {
    const todayStr = getBrazilDateParts(new Date());
    const thisMonthStr = todayStr.substring(0, 7);
    const thisYearStr = todayStr.substring(0, 4);

    return cashRegisters.filter(register => {
      const openDateStr = getBrazilDateParts(new Date(register.opened_at));
      switch (reportFilter) {
        case 'today':
          return openDateStr === todayStr;
        case 'week':
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const weekAgoStr = getBrazilDateParts(weekAgo);
          return openDateStr >= weekAgoStr && openDateStr <= todayStr;
        case 'month':
          return openDateStr.startsWith(thisMonthStr);
        case 'year':
          return openDateStr.startsWith(thisYearStr);
        case 'all':
        default:
          return true;
      }
    });
  }, [cashRegisters, reportFilter]);

  const getSaleRevenue = (s: any) => {
    const sum = (s.valor_dinheiro || 0) + (s.valor_cartao || 0) + (s.valor_pix || 0);
    return sum > 0 ? sum : (s.total_price || 0);
  };

  const getSaleCash = (s: any) => {
    if (s.valor_dinheiro !== undefined && s.valor_dinheiro !== null) {
      return s.valor_dinheiro;
    }
    return s.payment_method === 'dinheiro' ? (s.total_price || 0) : 0;
  };

  const getSaleCardOrPix = (s: any) => {
    if (s.valor_cartao !== undefined && s.valor_pix !== undefined && s.valor_cartao !== null && s.valor_pix !== null) {
      return (s.valor_cartao || 0) + (s.valor_pix || 0);
    }
    return s.payment_method !== 'dinheiro' ? (s.total_price || 0) : 0;
  };

  const salesByDay = filteredSalesForReport.reduce((acc: any[], sale) => {
    const date = new Date(sale.sale_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const existing = acc.find(item => item.date === date);
    const rev = getSaleRevenue(sale);
    if (existing) {
      existing.total += rev;
    } else {
      acc.push({ date, total: rev });
    }
    return acc;
  }, []).reverse().slice(reportFilter === 'all' ? -30 : reportFilter === 'year' ? -12 : reportFilter === 'month' ? -30 : -7);

  const salesByCategory = filteredSalesForReport.reduce((acc: any[], sale) => {
    const product = products.find(p => p.id === sale.product_id);
    const category = product?.category || 'Outros';
    const existing = acc.find(item => item.name === category);
    const rev = getSaleRevenue(sale);
    if (existing) {
      existing.value += rev;
    } else {
      acc.push({ name: category, value: rev });
    }
    return acc;
  }, []);

  const todayStr = getBrazilDateParts(new Date());
  const thisMonthStr = todayStr.substring(0, 7);
  const thisYearStr = todayStr.substring(0, 4);

  const filteredSalesByUser = sales.filter(s => {
    if (reportUserFilter !== 'all') {
      if (reportUserFilter === 'unknown' && s.user_id) return false;
      if (reportUserFilter !== 'unknown' && s.user_id !== reportUserFilter) return false;
    }
    return true;
  });

  const dashboardSalesThisMonth = sales
    .filter(s => getBrazilDateParts(new Date(s.sale_date)).startsWith(thisMonthStr))
    .filter(s => s.user_id === session?.user?.id)
    .reduce((acc, s) => acc + getSaleRevenue(s), 0);

  const salesToday = filteredSalesByUser
    .filter(s => getBrazilDateParts(new Date(s.sale_date)) === todayStr)
    .reduce((acc, s) => acc + getSaleRevenue(s), 0);

  const salesThisMonth = filteredSalesByUser
    .filter(s => getBrazilDateParts(new Date(s.sale_date)).startsWith(thisMonthStr))
    .reduce((acc, s) => acc + getSaleRevenue(s), 0);

  const salesThisYear = filteredSalesByUser
    .filter(s => getBrazilDateParts(new Date(s.sale_date)).startsWith(thisYearStr))
    .reduce((acc, s) => acc + getSaleRevenue(s), 0);

  const totalStockValue = products.reduce((acc, p) => acc + (p.current_stock * p.price), 0);
  const totalSalesAllTime = filteredSalesByUser.reduce((acc, s) => acc + getSaleRevenue(s), 0);
  const totalSalesFiltered = filteredSalesForReport.reduce((acc, s) => acc + getSaleRevenue(s), 0);
  const totalSalesCashFiltered = filteredSalesForReport.reduce((acc, s) => acc + getSaleCash(s), 0);
  const totalSalesCardFiltered = filteredSalesForReport.reduce((acc, s) => acc + getSaleCardOrPix(s), 0);

  const distinctUsers = useMemo(() => {
    const userMap = new Map<string, string>();
    if (session?.user?.id) {
      userMap.set(
        session.user.id,
        session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email || 'Meu Usuário Atual'
      );
    }
    sales.forEach(s => {
      if (s.user_id) {
        userMap.set(s.user_id, s.user_name || 'Usuário Desconhecido');
      }
    });
    return Array.from(userMap.entries())
      .map(([id, name]) => ({ id, name }))
      .filter(u => u.name !== 'Gabriel Calid Brito de Almeida');
  }, [sales, session]);

  const handlePrint = () => {
    window.print();
  };

  const handleAuditSubmit = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updates = Object.entries(auditCounts).map(([id, count]) => ({
        id: parseInt(id),
        current_stock: count
      }));

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ current_stock: update.current_stock })
          .eq('id', update.id);
        
        if (updateError) throw updateError;
      }

      setSuccessMessage("Inventário finalizado com sucesso!");
      setAuditCounts({});
      await fetchData();
      setActiveTab('inventory');
    } catch (err: any) {
      console.error("Audit Error:", err);
      setError(`Erro ao finalizar inventário: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!session) {
    return <Auth onLogin={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex text-slate-900 font-sans">
      {/* Payment Status Modal */}
      {paymentStatus === 'loading' && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
            <p className="text-white font-medium">Verificando acesso...</p>
          </div>
        </div>
      )}

      {paymentStatus !== 'pago' && paymentStatus !== 'loading' && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-2xl border border-slate-200">
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-4">ASSINATURA VENCIDA</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Entre em contato com o suporte.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleLogout}
                className="w-full bg-slate-100 text-slate-600 font-bold py-4 px-6 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Sair da Conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-[100] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Plus size={20} />
            </div>
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen no-print">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-200">
            <Package size={24} />
          </div>
          <h1 className="font-bold text-xl tracking-tight">VitalLog</h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
          />
          <NavItem 
            active={activeTab === 'inventory'} 
            onClick={() => setActiveTab('inventory')}
            icon={<Package size={20} />}
            label="Estoque"
          />
          <NavItem 
            active={activeTab === 'audit'} 
            onClick={() => setActiveTab('audit')}
            icon={<ClipboardList size={20} />}
            label="Inventário"
          />
          <NavItem 
            active={activeTab === 'labels'} 
            onClick={() => setActiveTab('labels')}
            icon={<Tag size={20} />}
            label="Etiquetas"
          />
          <NavItem 
            active={activeTab === 'pos'} 
            onClick={() => setActiveTab('pos')}
            icon={<ShoppingCart size={20} />}
            label="Caixa (PDV)"
          />
          <NavItem 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
            icon={<TrendingUp size={20} />}
            label="Relatórios"
          />
          <NavItem 
            active={activeTab === 'ai'} 
            onClick={() => setActiveTab('ai')}
            icon={<BrainCircuit size={20} />}
            label="IA Insights"
            badge={aiInsights.length > 0 ? aiInsights.length : undefined}
          />
          <NavItem 
            active={activeTab === 'xml'} 
            onClick={() => setActiveTab('xml')}
            icon={<FileCode size={20} />}
            label="Importar XML"
          />
          <NavItem 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<SettingsIcon size={20} />}
            label="Configurações"
          />
        </nav>

        <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
          <button 
            onClick={generateAIInsights}
            disabled={aiLoading}
            className="w-full flex items-center justify-center gap-2 bg-sky-50 text-sky-600 py-3 rounded-xl font-semibold hover:bg-sky-100 transition-colors disabled:opacity-50"
          >
            {aiLoading ? <RefreshCw size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
            Prever Demanda
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-slate-50 text-slate-600 py-3 rounded-xl font-semibold hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <LogOut size={18} />
            Alternar Operador
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto print-container ${(isReceiptModalOpen || closedRegisterSummary || isPrintingLabels) ? 'print:hidden' : ''}`}>
        <header className="h-20 bg-white border-bottom border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10 no-print">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar produtos, SKUs, código de barras..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium">{session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Operador'}</span>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Operador / Caixa</span>
            </div>
            <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden">
              <img src="https://picsum.photos/seed/user/100/100" alt="Avatar" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {error && activeTab !== 'pos' && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 bg-rose-50 border border-rose-200 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-rose-900">Problema de Conexão</h4>
                  <p className="text-rose-700 text-sm leading-relaxed">{error}</p>
                </div>
              </div>
              <button 
                onClick={fetchData}
                className="px-6 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all flex items-center gap-2 shrink-0"
              >
                <RefreshCw size={18} />
                Tentar Novamente
              </button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
                    <p className="text-slate-500 mt-1">Bem-vindo de volta! Aqui está o status do seu estoque hoje.</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2">
                      <Calendar size={16} />
                      Últimos 30 dias
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    title="Valor em Estoque" 
                    value={`R$ ${totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    trend="+12.5%"
                    trendUp={true}
                    icon={<Package className="text-sky-600" size={24} />}
                  />
                  <StatCard 
                    title="Vendas Mensais (Meu Usuário)" 
                    value={`R$ ${dashboardSalesThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    trend="+8.2%"
                    trendUp={true}
                    icon={<TrendingUp className="text-emerald-600" size={24} />}
                  />
                  <StatCard 
                    title="Produtos Baixos" 
                    value={lowStock.length.toString()}
                    trend={lowStock.length > 0 ? "Ação necessária" : "Tudo ok"}
                    trendUp={false}
                    icon={<AlertTriangle className="text-amber-500" size={24} />}
                    alert={lowStock.length > 0}
                  />
                  <StatCard 
                    title="Próximos ao Vencimento" 
                    value={expiring.length.toString()}
                    trend="Próximos 30 dias"
                    trendUp={false}
                    icon={<Calendar className="text-rose-500" size={24} />}
                    alert={expiring.length > 0}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Low Stock Table */}
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-lg">Produtos com Estoque Baixo</h3>
                        <button 
                          onClick={() => setActiveTab('inventory')}
                          className="text-sky-600 text-sm font-semibold hover:underline"
                        >
                          Ver todos
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                            <tr>
                              <th className="px-6 py-4 font-semibold">Produto</th>
                              <th className="px-6 py-4 font-semibold">Atual</th>
                              <th className="px-6 py-4 font-semibold">Mínimo</th>
                              <th className="px-6 py-4 font-semibold">Status</th>
                              <th className="px-6 py-4 font-semibold"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {lowStock.map(p => (
                              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium">{p.name}</td>
                                <td className="px-6 py-4 text-slate-600">{p.current_stock}</td>
                                <td className="px-6 py-4 text-slate-600">{p.min_stock}</td>
                                <td className="px-6 py-4">
                                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">Crítico</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={() => openEditModal(p)}
                                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-sky-600"
                                      title="Editar Produto"
                                    >
                                      <Pencil size={18} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProductToDelete(p.id);
                                      }}
                                      className="p-2 hover:bg-rose-50 rounded-lg transition-colors text-slate-400 hover:text-rose-600"
                                      title="Excluir Produto"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        addToCart(p);
                                        setActiveTab('pos');
                                      }}
                                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-sky-600"
                                      title="Vender"
                                    >
                                      <ShoppingCart size={18} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {lowStock.length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                  Nenhum produto com estoque baixo no momento.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Recent Products */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-lg">Produtos Adicionados Recentemente</h3>
                        <button 
                          onClick={() => setActiveTab('inventory')}
                          className="text-sky-600 text-sm font-semibold hover:underline"
                        >
                          Ver inventário completo
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                            <tr>
                              <th className="px-6 py-4 font-semibold">Produto</th>
                              <th className="px-6 py-4 font-semibold">Categoria</th>
                              <th className="px-6 py-4 font-semibold">Preço</th>
                              <th className="px-6 py-4 font-semibold">Estoque</th>
                              <th className="px-6 py-4 font-semibold"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {products.slice(0, 5).map(p => (
                              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium">{p.name}</td>
                                <td className="px-6 py-4 text-slate-600 text-sm">{p.category}</td>
                                <td className="px-6 py-4 text-slate-600 text-sm">R$ {p.price.toFixed(2)}</td>
                                <td className="px-6 py-4 text-slate-600 text-sm">{p.current_stock} un.</td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={() => openEditModal(p)}
                                      className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                                      title="Editar Produto"
                                    >
                                      <Pencil size={18} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProductToDelete(p.id);
                                      }}
                                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                      title="Excluir Produto"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Expiry Alerts */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="font-bold text-lg">Alertas de Vencimento</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {expiring.map(p => (
                        <div key={p.id} className="flex items-start gap-4 p-4 bg-rose-50 rounded-xl border border-rose-100">
                          <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600 shrink-0">
                            <AlertTriangle size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-rose-900">{p.name}</h4>
                            <p className="text-sm text-rose-700 mt-0.5">Vence em: {new Date(p.expiry_date).toLocaleDateString('pt-BR')}</p>
                            <div className="mt-2 flex gap-2">
                              <button 
                                onClick={() => openEditModal(p)}
                                className="text-xs font-bold text-rose-800 bg-rose-200 px-2 py-1 rounded hover:bg-rose-300 transition-colors"
                              >
                                Editar
                              </button>
                              <button className="text-xs font-bold text-rose-800 bg-rose-200 px-2 py-1 rounded hover:bg-rose-300 transition-colors">Promoção</button>
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductToDelete(p.id);
                                }}
                                className="text-xs font-bold text-rose-800 bg-rose-200 px-2 py-1 rounded hover:bg-rose-300 transition-colors"
                              >
                                Descartar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {expiring.length === 0 && (
                        <div className="py-12 text-center text-slate-400">
                          Nenhum produto próximo ao vencimento.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div 
                key="inventory"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold tracking-tight">Inventário</h2>
                  <button 
                    onClick={openAddModal}
                    className="bg-sky-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-sky-700 transition-all shadow-lg shadow-sky-200"
                  >
                    <Plus size={20} />
                    Novo Produto
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Cód. Barras</th>
                          <th className="px-6 py-4 font-semibold">Produto</th>
                          <th className="px-6 py-4 font-semibold">Categoria</th>
                          <th className="px-6 py-4 font-semibold">Preço</th>
                          <th className="px-6 py-4 font-semibold">Estoque</th>
                          <th className="px-6 py-4 font-semibold">Vencimento</th>
                          <th className="px-6 py-4 font-semibold">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{p.barcode}</td>
                            <td className="px-6 py-4 font-bold">{p.name}</td>
                            <td className="px-6 py-4 text-slate-600">{p.category}</td>
                            <td className="px-6 py-4 font-medium">R$ {p.price.toFixed(2)} / {p.unit || 'un'}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${p.current_stock <= p.min_stock ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                                {p.unit === 'kg' ? p.current_stock.toFixed(3) : p.current_stock} {p.unit || 'un'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{new Date(p.expiry_date).toLocaleDateString('pt-BR')}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => openEditModal(p)}
                                  className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                                  title="Editar Produto"
                                >
                                  <Pencil size={18} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProductToDelete(p.id);
                                  }}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Excluir Produto"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'pos' && (
              <motion.div 
                key="pos"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-[calc(100vh-12rem)]"
              >
                {!currentRegister ? (
                  <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm p-10 text-center">
                    <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center text-sky-600 mb-6">
                      <ShoppingCart size={40} />
                    </div>
                    <h2 className="text-3xl font-bold mb-4">Caixa Fechado</h2>
                    <p className="text-slate-500 mb-8 max-w-md">
                      Para realizar vendas, você precisa abrir o caixa informando o valor inicial (troco).
                    </p>
                    <button 
                      onClick={() => openRegisterModal()}
                      className="bg-sky-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 flex items-center gap-3"
                    >
                      <Plus size={24} />
                      Abrir Caixa
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                    {/* Product Selection */}
                    <div className="lg:col-span-2 flex flex-col space-y-6">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                          <input 
                            type="text" 
                            placeholder="Pesquisar produto por nome ou código de barras..." 
                            value={posSearch}
                            onChange={(e) => setPosSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && posSearch.trim() !== '') {
                                const exactMatch = products.find(p => p.barcode === posSearch.trim());
                                if (exactMatch) {
                                  addToCart(exactMatch);
                                  setPosSearch('');
                                } else if (filteredProductsForPOS.length === 1) {
                                  addToCart(filteredProductsForPOS[0]);
                                  setPosSearch('');
                                } else if (filteredProductsForPOS.length === 0) {
                                  setError("Produto não encontrado.");
                                  setTimeout(() => setError(null), 3000);
                                }
                              }
                            }}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-lg"
                          />
                        </div>
                        <button 
                          onClick={() => openRegisterModal()}
                          className="px-6 py-4 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-colors whitespace-nowrap"
                        >
                          Fechar Caixa
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredProductsForPOS.map(p => (
                          <button 
                            key={p.id}
                            onClick={() => addToCart(p)}
                        disabled={p.current_stock <= 0}
                        className={`p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-sky-500 hover:shadow-md transition-all text-left flex flex-col justify-between group ${p.current_stock <= 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{p.category}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${p.current_stock <= p.min_stock ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              {p.current_stock} em estoque
                            </span>
                          </div>
                          <h4 className="font-bold text-lg group-hover:text-sky-600 transition-colors">{p.name}</h4>
                          <p className="text-xs text-slate-400 font-mono mt-1">{p.barcode}</p>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xl font-black text-slate-900">R$ {p.price.toFixed(2)} <span className="text-xs font-bold text-slate-400">/ {p.unit || 'un'}</span></span>
                          <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-all">
                            <Plus size={20} />
                          </div>
                        </div>
                      </button>
                    ))}
                    {filteredProductsForPOS.length === 0 && (
                      <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400">Nenhum produto encontrado.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cart / Checkout */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl flex flex-col overflow-hidden">
                  {error && activeTab === 'pos' && (
                    <div className="p-4 bg-rose-50 border-b border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle size={14} />
                      <span className="flex-1">{error}</span>
                      <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center text-white">
                        <ShoppingCart size={20} />
                      </div>
                      <h3 className="font-bold text-xl">Carrinho</h3>
                    </div>
                    <span className="bg-sky-100 text-sky-600 px-3 py-1 rounded-full text-xs font-bold">
                      {cart.length} itens
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex items-center gap-4 group">
                        <div className="flex-1">
                          <h5 className="font-bold text-sm leading-tight">{item.product.name}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-slate-400">R$ {item.product.price.toFixed(2)} / {item.product.unit || 'un'}</p>
                            <div className="flex items-center gap-1 bg-slate-100 rounded px-1.5 py-0.5">
                              <span className="text-[10px] font-bold text-slate-500">DESC%</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.discountPercentage || ''}
                                onChange={(e) => updateCartItemDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                                className="w-10 text-xs bg-transparent text-right outline-none font-bold text-sky-600"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                          <button 
                            onClick={() => updateCartQuantity(item.product.id, -1)}
                            disabled={item.product.unit === 'kg'}
                            className={`w-6 h-6 flex items-center justify-center hover:bg-white rounded transition-colors text-slate-600 ${item.product.unit === 'kg' ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            -
                          </button>
                          <span className="min-w-[40px] text-center text-xs font-bold">
                            {item.product.unit === 'kg' ? item.quantity.toFixed(3) : item.quantity}
                            {item.product.unit === 'kg' ? ' kg' : ''}
                          </span>
                          <button 
                            onClick={() => updateCartQuantity(item.product.id, 1)}
                            disabled={item.product.unit === 'kg'}
                            className={`w-6 h-6 flex items-center justify-center hover:bg-white rounded transition-colors text-slate-600 ${item.product.unit === 'kg' ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            +
                          </button>
                        </div>
                        <div className="text-right min-w-[80px] flex flex-col items-end gap-1">
                          <p className="font-bold text-sm">
                            R$ {(item.product.price * item.quantity * (1 - (item.discountPercentage || 0) / 100)).toFixed(2)}
                          </p>
                          {item.discountPercentage ? (
                            <p className="text-[10px] text-slate-400 line-through">
                              R$ {(item.product.price * item.quantity).toFixed(2)}
                            </p>
                          ) : null}
                          <button 
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remover do Carrinho"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                        <ShoppingCart size={48} />
                        <p className="font-medium">Seu carrinho está vazio</p>
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-500 text-sm">
                        <span>Subtotal</span>
                        <span>R$ {cartSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500 text-sm">
                        <span>Desconto</span>
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            value={cartDiscount || ''}
                            onChange={(e) => setCartDiscount(Math.min(cartSubtotal, Math.max(0, parseFloat(e.target.value) || 0)))}
                            className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded text-right focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-slate-900 font-black text-2xl pt-2 border-t border-slate-200">
                        <span>Total</span>
                        <span>R$ {cartTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          setCart([]);
                          setCartDiscount(0);
                        }}
                        disabled={cart.length === 0 || isProcessingSale}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                      >
                        Limpar
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedPaymentMethod('dinheiro');
                          setMixedCashAmount(0);
                          setMixedCardAmount(cartTotal);
                          setAmountReceived(cartTotal);
                          setIsPaymentModalOpen(true);
                        }}
                        disabled={isProcessingSale || cart.length === 0}
                        className={`flex-[2] py-4 text-white rounded-2xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-3 ${
                          cart.length === 0 
                            ? 'bg-slate-400 cursor-not-allowed opacity-70' 
                            : 'bg-sky-600 hover:bg-sky-700 shadow-sky-200'
                        } ${isProcessingSale ? 'grayscale cursor-wait' : ''}`}
                      >
                        {isProcessingSale ? (
                          <RefreshCw className="animate-spin" size={24} />
                        ) : (
                          <CheckCircle2 size={24} />
                        )}
                        {isProcessingSale ? 'Processando...' : 'Finalizar Venda'}
                      </button>
                    </div>
                    {cart.length > 0 && (
                      <p className="text-[10px] text-slate-400 text-center mt-2">
                        Clique para confirmar a venda e atualizar o estoque.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

            {activeTab === 'reports' && (
              <motion.div 
                id="report-content"
                key="reports"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Relatórios Financeiros</h2>
                    <p className="text-slate-500 mt-1">Acompanhe o desempenho das suas vendas e saúde financeira.</p>
                  </div>
                  <div className="flex gap-3 no-print">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                      <Calendar size={18} className="text-slate-500" />
                      <select 
                        value={reportFilter}
                        onChange={(e) => setReportFilter(e.target.value as any)}
                        className="bg-transparent text-sm font-bold outline-none cursor-pointer text-slate-700"
                      >
                        <option value="today">Hoje</option>
                        <option value="week">Esta Semana</option>
                        <option value="month">Este Mês</option>
                        <option value="year">Este Ano</option>
                        <option value="all">Todo o Período</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                      <User size={18} className="text-slate-500" />
                      <select 
                        value={reportUserFilter}
                        onChange={(e) => setReportUserFilter(e.target.value)}
                        className="bg-transparent text-sm font-bold outline-none cursor-pointer text-slate-700"
                      >
                        <option value="all">Todos os Operadores</option>
                        {distinctUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                        <option value="unknown">Sem Operador Registrado</option>
                      </select>
                    </div>
                    <button 
                      onClick={handlePrint}
                      className="px-4 py-2 bg-sky-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-sky-700 transition-all shadow-lg shadow-sky-100"
                    >
                      <Printer size={18} />
                      Imprimir Relatório
                    </button>
                  </div>
                </div>

                <div className="print-only mb-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-sky-600 rounded-xl flex items-center justify-center text-white">
                      <Package size={28} />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold">Relatório VitalLog</h1>
                      <p className="text-slate-500">Gerado em {new Date().toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-200 w-full mb-8"></div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 mb-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print-card">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
                      <DollarSign size={24} />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Vendas Hoje</p>
                    <h3 className="text-3xl font-black mt-1">R$ {salesToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print-card">
                    <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 mb-4">
                      <Calendar size={24} />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Vendas no Mês</p>
                    <h3 className="text-3xl font-black mt-1">R$ {salesThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print-card">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                      <TrendingUp size={24} />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Vendas no Ano</p>
                    <h3 className="text-3xl font-black mt-1">R$ {salesThisYear.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print-card">
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-700 mb-4">
                      <DollarSign size={24} />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Recebido em Dinheiro (Filtro)</p>
                    <h3 className="text-3xl font-black mt-1">R$ {totalSalesCashFiltered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print-card">
                    <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center text-sky-700 mb-4">
                      <CreditCard size={24} />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Recebido em Cartão/PIX (Filtro)</p>
                    <h3 className="text-3xl font-black mt-1">R$ {totalSalesCardFiltered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print-card">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
                      <PieChart size={24} />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Ticket Médio (Filtro)</p>
                    <h3 className="text-3xl font-black mt-1">
                      R$ {filteredSalesForReport.length > 0 ? (totalSalesFiltered / filteredSalesForReport.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Sales Chart */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm print-card">
                    <h3 className="font-bold text-xl mb-8">Vendas nos Últimos 7 Dias</h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={salesByDay}>
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0284c7" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 12}} 
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 12}} 
                            tickFormatter={(value) => `R$ ${value}`}
                          />
                          <Tooltip 
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Vendas']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="total" 
                            stroke="#0284c7" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorTotal)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Sales by Category */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm print-card">
                    <h3 className="font-bold text-xl mb-8">Vendas por Categoria</h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salesByCategory} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}}
                            width={100}
                          />
                          <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                          />
                          <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={30}>
                            {salesByCategory.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Cash Registers Report */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print-card">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-xl">Histórico de Fechamento de Caixa</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-bold">Data/Hora Abertura</th>
                          <th className="px-6 py-4 font-bold">Data/Hora Fechamento</th>
                          <th className="px-6 py-4 font-bold">Status</th>
                          <th className="px-6 py-4 font-bold">Saldo Inicial</th>
                          <th className="px-6 py-4 font-bold">Saldo Final (Informado)</th>
                          <th className="px-6 py-4 font-bold">Vendas no Caixa</th>
                          <th className="px-6 py-4 font-bold">Diferença</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCashRegistersForReport.map(register => {
                          const registerSales = sales.filter(s => s.cash_register_id === register.id);
                          const totalSales = registerSales.reduce((acc, s) => acc + getSaleRevenue(s), 0);
                          const expectedFinal = register.initial_balance + registerSales.reduce((acc, s) => acc + getSaleCash(s), 0);
                          const difference = register.final_balance !== null ? register.final_balance - expectedFinal : 0;

                          return (
                            <tr key={register.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 text-sm text-slate-500">{new Date(register.opened_at).toLocaleString('pt-BR')}</td>
                              <td className="px-6 py-4 text-sm text-slate-500">{register.closed_at ? new Date(register.closed_at).toLocaleString('pt-BR') : '-'}</td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${register.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                  {register.status === 'open' ? 'Aberto' : 'Fechado'}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-bold">R$ {register.initial_balance.toFixed(2)}</td>
                              <td className="px-6 py-4 font-bold">{register.final_balance !== null ? `R$ ${register.final_balance.toFixed(2)}` : '-'}</td>
                              <td className="px-6 py-4 text-sky-600 font-black">R$ {totalSales.toFixed(2)}</td>
                              <td className="px-6 py-4">
                                {register.status === 'closed' && register.final_balance !== null ? (
                                  <span className={`font-black ${difference === 0 ? 'text-emerald-600' : difference > 0 ? 'text-sky-600' : 'text-rose-600'}`}>
                                    {difference > 0 ? '+' : ''}R$ {difference.toFixed(2)}
                                  </span>
                                ) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredCashRegistersForReport.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400">Nenhum registro de caixa encontrado.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Sales Table */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print-card">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-xl">Histórico de Vendas Recentes</h3>
                    <button className="text-sky-600 font-bold text-sm hover:underline no-print">Ver tudo</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-bold">Data/Hora</th>
                          <th className="px-6 py-4 font-bold">Produto</th>
                          <th className="px-6 py-4 font-bold">Qtd</th>
                          <th className="px-6 py-4 font-bold">Total</th>
                          <th className="px-6 py-4 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSalesForReport.slice(0, 10).map(sale => (
                          <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {new Date(sale.sale_date).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 font-bold">{sale.product_name}</td>
                            <td className="px-6 py-4 text-slate-600">
                              {Number.isInteger(sale.quantity) ? sale.quantity : sale.quantity.toFixed(3)} 
                              {Number.isInteger(sale.quantity) ? ' un.' : ' kg'}
                            </td>
                            <td className="px-6 py-4 font-black">R$ {sale.total_price.toFixed(2)}</td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full">Concluída</span>
                            </td>
                          </tr>
                        ))}
                        {filteredSalesForReport.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">Nenhuma venda registrada ainda.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div 
                key="ai"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                <div className="bg-sky-600 rounded-3xl p-10 text-white relative overflow-hidden shadow-2xl shadow-sky-200">
                  <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                      <BrainCircuit size={14} />
                      IA VitalLog Ativa
                    </div>
                    <h2 className="text-4xl font-bold mb-4 leading-tight">Previsão de Demanda & Sugestões de Compra</h2>
                    <p className="text-sky-100 text-lg leading-relaxed">
                      Nossa inteligência artificial analisou seu histórico de vendas e níveis de estoque para sugerir as melhores ações para os próximos 30 dias.
                    </p>
                  </div>
                  <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
                    <BrainCircuit size={400} className="translate-x-1/4 -translate-y-1/4" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {aiInsights.map((insight, idx) => (
                    <motion.div 
                      key={`${insight.productId}-${idx}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-300 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <h3 className="font-bold text-xl">{insight.productName}</h3>
                          <p className="text-slate-500 text-sm">ID: #{insight.productId}</p>
                        </div>
                        <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                          <ShoppingCart size={24} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50 p-4 rounded-xl">
                          <span className="text-xs text-slate-500 uppercase font-bold tracking-wider block mb-1">Demanda Prevista</span>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">{insight.predictedDemand}</span>
                            <span className="text-xs text-slate-400">un / mês</span>
                          </div>
                        </div>
                        <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                          <span className="text-xs text-sky-600 uppercase font-bold tracking-wider block mb-1">Sugestão de Compra</span>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-sky-700">{insight.suggestedRestock}</span>
                            <span className="text-xs text-sky-400">unidades</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl mb-6">
                        <p className="text-sm text-slate-600 italic leading-relaxed">
                          "{insight.reason}"
                        </p>
                      </div>

                      <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                        Aprovar Pedido de Compra
                        <ChevronRight size={18} />
                      </button>
                    </motion.div>
                  ))}
                  {aiInsights.length === 0 && !aiLoading && (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
                        <BrainCircuit size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-600">Nenhum insight gerado ainda</h3>
                      <p className="text-slate-400 mt-2">Clique em "Prever Demanda" na barra lateral para começar.</p>
                      <button 
                        onClick={generateAIInsights}
                        className="mt-6 px-8 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-all"
                      >
                        Gerar Insights Agora
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {activeTab === 'xml' && (
              <motion.div 
                key="xml"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Importar Nota Fiscal (XML)</h2>
                    <p className="text-slate-500 mt-1">Carregue o arquivo XML da NFe para atualizar seu estoque automaticamente.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 mb-6">
                        <Upload size={32} />
                      </div>
                      <h3 className="text-lg font-bold mb-2">Carregar Arquivo XML</h3>
                      <p className="text-slate-400 text-sm mb-6">Selecione o arquivo .xml da nota fiscal eletrônica</p>
                      
                      <label className="w-full">
                        <input 
                          type="file" 
                          accept=".xml" 
                          onChange={handleXmlUpload}
                          className="hidden"
                        />
                        <div className="w-full py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-sky-200">
                          {isParsingXml ? <RefreshCw size={20} className="animate-spin" /> : <FileCode size={20} />}
                          Selecionar XML
                        </div>
                      </label>
                    </div>

                    {xmlProducts.length > 0 && (
                      <div className="bg-sky-900 text-white p-8 rounded-3xl shadow-xl">
                        <h3 className="font-bold text-xl mb-4">Resumo da Nota</h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center py-3 border-b border-white/10">
                            <span className="text-sky-200">Total de Itens</span>
                            <span className="font-bold text-lg">{xmlProducts.length}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-white/10">
                            <span className="text-sky-200">Itens Vinculados</span>
                            <span className="font-bold text-lg text-emerald-400">
                              {xmlProducts.filter(p => p.matchedProductId).length}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-3">
                            <span className="text-sky-200">Itens Não Encontrados</span>
                            <span className="font-bold text-lg text-rose-400">
                              {xmlProducts.filter(p => !p.matchedProductId).length}
                            </span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={syncXmlToStock}
                          disabled={isSaving}
                          className="w-full mt-8 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSaving ? <RefreshCw size={20} className="animate-spin" /> : <Link size={20} />}
                          Confirmar Nota
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-bold text-lg">Produtos na Nota</h3>
                        {xmlProducts.length > 0 && (
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => setXmlProducts([])}
                              className="text-slate-400 font-medium hover:text-rose-600 transition-colors"
                            >
                              Limpar XML
                            </button>
                            <button 
                              onClick={syncXmlToStock}
                              disabled={isSaving}
                              className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                            >
                              {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Link size={18} />}
                              Confirmar Nota
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                            <tr>
                              <th className="px-6 py-4 font-bold">Cód. Barras (Nota)</th>
                              <th className="px-6 py-4 font-bold">Produto</th>
                              <th className="px-6 py-4 font-bold">Qtd</th>
                              <th className="px-6 py-4 font-bold">Status</th>
                              <th className="px-6 py-4 font-bold text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {xmlProducts.map((p, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs text-slate-500">{p.barcode}</td>
                                <td className="px-6 py-4">
                                  <div className="font-bold">{p.name}</div>
                                  <div className="text-xs text-slate-400">Preço Unit: R$ {p.price.toFixed(2)}</div>
                                </td>
                                <td className="px-6 py-4 font-bold text-sky-600">+{p.quantity}</td>
                                <td className="px-6 py-4">
                                  {p.matchedProductId ? (
                                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase">
                                      <CheckCircle2 size={14} />
                                      Vinculado
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-rose-500 text-xs font-bold uppercase">
                                      <AlertTriangle size={14} />
                                      Não Cadastrado
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => setXmlProducts(prev => prev.filter((_, i) => i !== idx))}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Remover da Lista"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {xmlProducts.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-20 text-center text-slate-400">
                                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FileText size={32} className="text-slate-200" />
                                  </div>
                                  Nenhum arquivo carregado.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'audit' && (
              <motion.div 
                key="audit"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Balanço de Inventário</h2>
                    <p className="text-slate-500 mt-1">Realize a contagem física dos produtos e atualize o estoque do sistema.</p>
                  </div>
                  <button 
                    onClick={handleAuditSubmit}
                    disabled={isSaving || Object.keys(auditCounts).length === 0}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                    Finalizar Inventário
                  </button>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="relative w-96">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Filtrar produtos para contagem..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                      />
                    </div>
                    <div className="text-sm text-slate-500 font-medium">
                      {Object.keys(auditCounts).length} itens alterados
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-bold">Produto</th>
                          <th className="px-6 py-4 font-bold">Cód. Barras</th>
                          <th className="px-6 py-4 font-bold">Estoque Atual</th>
                          <th className="px-6 py-4 font-bold">Contagem Física</th>
                          <th className="px-6 py-4 font-bold">Diferença</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map(p => {
                          const counted = auditCounts[p.id] !== undefined ? auditCounts[p.id] : p.current_stock;
                          const diff = counted - p.current_stock;
                          
                          return (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-bold">{p.name}</div>
                                <div className="text-xs text-slate-400">{p.category}</div>
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-slate-500">{p.barcode}</td>
                              <td className="px-6 py-4 font-medium text-slate-600">
                                {p.unit === 'kg' ? p.current_stock.toFixed(3) : p.current_stock} {p.unit || 'un'}
                              </td>
                              <td className="px-6 py-4">
                                <input 
                                  type="number"
                                  step={p.unit === 'kg' ? "0.001" : "1"}
                                  value={counted}
                                  onChange={(e) => {
                                    const val = p.unit === 'kg' ? parseFloat(e.target.value) : parseInt(e.target.value);
                                    if (!isNaN(val)) {
                                      setAuditCounts(prev => ({ ...prev, [p.id]: val }));
                                    }
                                  }}
                                  className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all font-bold"
                                />
                              </td>
                              <td className="px-6 py-4">
                                {diff !== 0 ? (
                                  <span className={`font-bold ${diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {diff > 0 ? '+' : ''}{p.unit === 'kg' ? diff.toFixed(3) : diff}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'labels' && (
              <motion.div 
                key="labels"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Etiquetas</h2>
                    <p className="text-slate-500 mt-1">Imprima etiquetas com código de barras para seus produtos.</p>
                  </div>
                  <button 
                    onClick={handlePrintLabels}
                    disabled={labelQueue.length === 0}
                    className="px-6 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Printer size={20} />
                    Imprimir Etiquetas
                  </button>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                  {/* Left Column: Product Selection */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                          type="text"
                          placeholder="Buscar produtos para imprimir..."
                          value={posSearch}
                          onChange={(e) => setPosSearch(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all text-sm"
                        />
                      </div>

                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {filteredProducts.map(product => (
                          <div key={product.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-2xl hover:border-sky-200 hover:bg-sky-50 transition-colors">
                            <div className="flex gap-4 items-center">
                              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                                <Package size={24} />
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 line-clamp-1">{product.name}</h3>
                                <p className="text-sm text-slate-500">
                                  {product.barcode ? product.barcode : 'Sem código'} • R$ {product.price.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => addToLabelQueue(product)}
                              className="w-10 h-10 shrink-0 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-sky-100 hover:text-sky-600 transition-colors"
                            >
                              <Plus size={20} />
                            </button>
                          </div>
                        ))}
                        {filteredProducts.length === 0 && (
                          <div className="text-center py-8 text-slate-400">Nenhum produto encontrado.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Queue Details */}
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-lg mb-4">Filas de Impressão</h3>
                      
                      <div className="mb-6 space-y-2">
                        <label className="text-sm font-bold text-slate-700">Tamanho da Etiqueta</label>
                        <select 
                          value={labelSize}
                          onChange={(e) => setLabelSize(e.target.value as any)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium text-slate-700"
                        >
                          <option value="40x40">Térmica 40x40mm</option>
                          <option value="60x40">Térmica 60x40mm</option>
                          <option value="pimaco">Folha A4 (Pimaco - 3 col)</option>
                        </select>
                      </div>

                      <div className="space-y-4">
                        {labelQueue.map(item => (
                          <div key={item.product.id} className="flex flex-col gap-2 p-3 border border-slate-100 rounded-xl bg-slate-50">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-sm text-slate-800 line-clamp-1 flex-1">{item.product.name}</span>
                              <button onClick={() => removeFromLabelQueue(item.product.id)} className="text-rose-500 hover:bg-rose-100 p-1 rounded-md transition-colors ml-2">
                                <X size={14} />
                              </button>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                              {item.product.barcode && <div className="text-xs text-slate-400 font-mono">{item.product.barcode}</div>}
                              {!item.product.barcode && <div className="text-xs text-amber-500">Sem código</div>}
                              
                              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 ml-auto">
                                <button
                                  onClick={() => updateLabelQuantity(item.product.id, item.quantity - 1)}
                                  className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                                <button
                                  onClick={() => updateLabelQuantity(item.product.id, item.quantity + 1)}
                                  className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {labelQueue.length === 0 && (
                          <p className="text-sm text-slate-500 mt-4 text-center">A fila está vazia.</p>
                        )}
                        {labelQueue.length > 0 && (
                          <div className="pt-4 border-t border-slate-200 mt-4 flex justify-between items-center text-sm font-bold">
                            <span className="text-slate-600">Total de etiquetas:</span>
                            <span className="text-slate-900">{labelQueue.reduce((acc, item) => acc + item.quantity, 0)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Configurações</h2>
                    <p className="text-slate-500 mt-1">Gerencie os dados do seu estabelecimento e recibos</p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm max-w-2xl">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Printer className="text-sky-600" size={24} />
                    Dados do Cupom Fiscal
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Nome do Estabelecimento</label>
                      <input 
                        type="text" 
                        value={storeSettings.name}
                        onChange={e => setStoreSettings({...storeSettings, name: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">CNPJ / CPF</label>
                        <input 
                          type="text" 
                          value={storeSettings.document}
                          onChange={e => setStoreSettings({...storeSettings, document: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Inscrição Estadual (IE)</label>
                        <input 
                          type="text" 
                          value={storeSettings.ie}
                          onChange={e => setStoreSettings({...storeSettings, ie: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Telefone</label>
                        <input 
                          type="text" 
                          value={storeSettings.phone}
                          onChange={e => setStoreSettings({...storeSettings, phone: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Endereço</label>
                      <input 
                        type="text" 
                        value={storeSettings.address}
                        onChange={e => setStoreSettings({...storeSettings, address: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Mensagem de Rodapé</label>
                      <textarea 
                        value={storeSettings.message}
                        onChange={e => setStoreSettings({...storeSettings, message: e.target.value})}
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all resize-none"
                      />
                    </div>

                    <div className="pt-4 flex gap-4 border-t border-slate-100">
                      <button 
                        onClick={async () => {
                          try {
                            setIsSaving(true);
                            if (session?.user?.id) {
                              const { error } = await supabase
                                .from('store_settings')
                                .upsert({
                                  user_id: session.user.id,
                                  name: storeSettings.name,
                                  document: storeSettings.document,
                                  ie: storeSettings.ie,
                                  address: storeSettings.address,
                                  phone: storeSettings.phone,
                                  message: storeSettings.message
                                });
                              if (error) throw error;
                            }
                            localStorage.setItem('storeSettings', JSON.stringify(storeSettings));
                            setSuccessMessage('Configurações salvas com sucesso!');
                          } catch (err) {
                            console.error('Error saving settings', err);
                            setError('Erro ao salvar as configurações.');
                          } finally {
                            setIsSaving(false);
                            setTimeout(() => setSuccessMessage(null), 3000);
                            setTimeout(() => setError(null), 3000);
                          }
                        }}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSaving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                        {isSaving ? 'Salvando...' : 'Salvar Configurações'}
                      </button>
                      <button 
                        onClick={() => {
                          setReceiptData({
                            items: [
                              { product: { id: 1, name: 'Produto Exemplo 1', price: 15.50, unit: 'un', current_stock: 10, min_stock: 5, category: 'Teste', barcode: '7890000000001', expiry_date: '2026-12-31', created_at: '' }, quantity: 2 },
                              { product: { id: 2, name: 'Produto Exemplo 2', price: 25.00, unit: 'kg', current_stock: 10, min_stock: 5, category: 'Teste', barcode: '7890000000002', expiry_date: '2026-12-31', created_at: '' }, quantity: 1.5 }
                            ],
                            total: 68.50,
                            paymentMethod: 'dinheiro',
                            amountReceived: 100.00,
                            change: 31.50,
                            date: new Date().toISOString()
                          });
                          setIsReceiptModalOpen(true);
                        }}
                        className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <Printer size={20} />
                        Testar Impressão
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Label Printing Overlay */}
      {isPrintingLabels && (
        <div className="fixed inset-0 bg-white z-[9999] print:block hidden">
          <div className={
             labelSize === 'pimaco' ? 'p-4 grid grid-cols-3 gap-2 w-[210mm]' : 'flex flex-col items-center'
          }>
             {labelQueue.flatMap(item => Array.from({length: item.quantity}).map((_, i) => (
               <div key={`${item.product.id}-${i}`} className={`
                 flex flex-col items-center justify-center border-slate-300 text-center bg-white overflow-hidden
                 ${labelSize === '40x40' ? 'w-[40mm] h-[40mm] p-1 border' : ''}
                 ${labelSize === '60x40' ? 'w-[60mm] h-[40mm] p-2 border' : ''}
                 ${labelSize === 'pimaco' ? 'w-full h-[30mm] p-2 border rounded-md' : ''}
               `} style={{ pageBreakAfter: labelSize !== 'pimaco' ? 'always' : 'auto' }}>
                  <div className="font-bold text-[10px] break-words line-clamp-1 mb-0.5">{storeSettings.name}</div>
                  <div className="font-bold text-[11px] leading-tight break-words line-clamp-2 w-full px-1">{item.product.name}</div>
                  <div className="font-black text-sm my-0.5">R$ {item.product.price.toFixed(2)}</div>
                  {item.product.barcode && (
                    <div className="w-full flex justify-center scale-75 origin-top mb-[-10px]">
                      <BarcodeComponent value={item.product.barcode} width={1.2} height={25} fontSize={10} margin={0} background="transparent" />
                    </div>
                  )}
               </div>
             )))}
          </div>
        </div>
      )}

      {/* New Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-2xl font-bold">{editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSaveProduct} className="p-8 space-y-6">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-medium flex items-center gap-2"
                  >
                    <AlertTriangle size={18} />
                    {error}
                  </motion.div>
                )}
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nome do Produto</label>
                    <input 
                      required
                      type="text" 
                      value={newProduct.name}
                      onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                      placeholder="Ex: Arroz Integral"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Categoria</label>
                    <input 
                      required
                      type="text" 
                      value={newProduct.category}
                      onChange={e => {
                        const category = e.target.value;
                        const isFruit = category.toLowerCase().includes('fruta');
                        setNewProduct({
                          ...newProduct, 
                          category, 
                          unit: isFruit ? 'kg' : newProduct.unit
                        });
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                      placeholder="Ex: Grãos"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Código de Barras</label>
                    <input 
                      required
                      type="text" 
                      value={newProduct.barcode}
                      onChange={e => setNewProduct({...newProduct, barcode: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                      placeholder="Ex: 7891234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">{editingProduct ? 'Estoque Atual' : 'Estoque Inicial'}</label>
                    <input 
                      required
                      type="number" 
                      step={newProduct.unit === 'kg' ? "0.001" : "1"}
                      value={newProduct.current_stock}
                      onChange={e => setNewProduct({...newProduct, current_stock: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Estoque Mínimo</label>
                    <input 
                      required
                      type="number" 
                      step={newProduct.unit === 'kg' ? "0.001" : "1"}
                      value={newProduct.min_stock}
                      onChange={e => setNewProduct({...newProduct, min_stock: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Preço de Venda (R$)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Unidade de Medida</label>
                    <select 
                      value={newProduct.unit}
                      onChange={e => setNewProduct({...newProduct, unit: e.target.value as 'un' | 'kg'})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                    >
                      <option value="un">Unidade (un)</option>
                      <option value="kg">Quilograma (kg)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Data de Vencimento</label>
                    <input 
                      required
                      type="date" 
                      value={newProduct.expiry_date}
                      onChange={e => setNewProduct({...newProduct, expiry_date: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-[2] py-4 bg-sky-600 text-white rounded-2xl font-bold hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="animate-spin" size={20} />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Plus size={20} />
                        Salvar Produto
                      </>
                    )}
                  </button>
                </div>
              </form>
              {/* Debug Info for User */}
              <div className="px-8 pb-8">
                <p className="text-[10px] text-slate-400 text-center">
                  Dica: Se o erro persistir, verifique se o RLS está desativado no Supabase.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Produto?</h3>
              <p className="text-slate-600 mb-8">Esta ação excluirá o produto e <strong>todas as vendas vinculadas</strong> a ele permanentemente.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteProduct(productToDelete)}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cash Register Modal */}
      <AnimatePresence>
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-slate-900">
                  {currentRegister ? 'Fechamento de Caixa' : 'Abertura de Caixa'}
                </h3>
                <button 
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {!currentRegister ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Valor Inicial (Troco)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={registerInitialBalance}
                        onChange={(e) => setRegisterInitialBalance(parseFloat(e.target.value) || 0)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-lg font-bold"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={openRegister}
                    className="w-full py-4 bg-sky-600 text-white rounded-xl font-bold text-lg hover:bg-sky-700 transition-all shadow-lg shadow-sky-200"
                  >
                    Confirmar Abertura
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Valor Inicial</span>
                      <span className="font-bold">R$ {currentRegister.initial_balance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Vendas (Dinheiro)</span>
                      <span className="font-bold text-emerald-600">
                        {isFetchingRegisterSales ? 'Calculando...' : `+ R$ ${registerSalesCash.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Vendas (Cartão/PIX)</span>
                      <span className="font-bold text-sky-600">
                        {isFetchingRegisterSales ? 'Calculando...' : `+ R$ ${registerSalesOther.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-slate-200 flex justify-between">
                      <span className="font-bold text-slate-700">Total Esperado em Caixa</span>
                      <span className="font-black text-lg">
                        {isFetchingRegisterSales ? 'Calculando...' : `R$ ${(currentRegister.initial_balance + registerSalesCash).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Valor de Fechamento (Informado)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={registerFinalBalance}
                        onChange={(e) => setRegisterFinalBalance(parseFloat(e.target.value) || 0)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-lg font-bold"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={closeRegister}
                    className="w-full py-4 bg-rose-600 text-white rounded-xl font-bold text-lg hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                  >
                    Confirmar Fechamento
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {/* Weight Input Modal */}
        <AnimatePresence>
          {isWeightModalOpen && selectedProductForWeight && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center text-white">
                      <Scale size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl">Pesar Produto</h3>
                      <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">{selectedProductForWeight.name}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsWeightModalOpen(false)}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleWeightSubmit} className="p-8 space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-slate-500 mb-2">Informe o peso em quilogramas (kg)</p>
                    <div className="relative">
                      <input 
                        autoFocus
                        required
                        type="text"
                        inputMode="decimal"
                        value={weightInput}
                        onChange={e => setWeightInput(e.target.value)}
                        placeholder="0,000"
                        className="w-full text-center text-5xl font-black py-6 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all"
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">kg</span>
                    </div>
                    <div className="mt-4 p-4 bg-sky-50 rounded-xl flex justify-between items-center">
                      <span className="text-sky-700 font-medium">Preço por kg:</span>
                      <span className="text-sky-900 font-bold text-lg">R$ {selectedProductForWeight.price.toFixed(2)}</span>
                    </div>
                    {weightInput && !isNaN(parseFloat(weightInput.replace(',', '.'))) && (
                      <div className="mt-2 p-4 bg-emerald-50 rounded-xl flex justify-between items-center">
                        <span className="text-emerald-700 font-medium">Subtotal:</span>
                        <span className="text-emerald-900 font-bold text-xl">
                          R$ {(selectedProductForWeight.price * parseFloat(weightInput.replace(',', '.'))).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setIsWeightModalOpen(false)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-4 bg-sky-600 text-white rounded-2xl font-bold hover:bg-sky-700 transition-all shadow-lg shadow-sky-200"
                    >
                      Confirmar Peso
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Pagamento</h3>
                <button 
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-8 text-center">
                <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Total a Pagar</p>
                <p className="text-5xl font-black text-slate-900">R$ {cartTotal.toFixed(2)}</p>
              </div>

              <div className="space-y-3 mb-8">
                <label className="block text-sm font-bold text-slate-700 mb-2">Forma de Pagamento</label>
                
                <button 
                  onClick={() => {
                    setSelectedPaymentMethod('dinheiro');
                    setAmountReceived(cartTotal);
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${selectedPaymentMethod === 'dinheiro' ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedPaymentMethod === 'dinheiro' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <DollarSign size={20} />
                    </div>
                    <span className="font-bold text-slate-700">Dinheiro</span>
                  </div>
                  {selectedPaymentMethod === 'dinheiro' && <CheckCircle2 className="text-sky-600" size={20} />}
                </button>

                <button 
                  onClick={() => setSelectedPaymentMethod('cartao_credito')}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${selectedPaymentMethod === 'cartao_credito' ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedPaymentMethod === 'cartao_credito' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <CreditCard size={20} />
                    </div>
                    <span className="font-bold text-slate-700">Cartão de Crédito</span>
                  </div>
                  {selectedPaymentMethod === 'cartao_credito' && <CheckCircle2 className="text-sky-600" size={20} />}
                </button>

                <button 
                  onClick={() => setSelectedPaymentMethod('cartao_debito')}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${selectedPaymentMethod === 'cartao_debito' ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedPaymentMethod === 'cartao_debito' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <CreditCard size={20} />
                    </div>
                    <span className="font-bold text-slate-700">Cartão de Débito</span>
                  </div>
                  {selectedPaymentMethod === 'cartao_debito' && <CheckCircle2 className="text-sky-600" size={20} />}
                </button>

                <button 
                  onClick={() => setSelectedPaymentMethod('pix')}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${selectedPaymentMethod === 'pix' ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedPaymentMethod === 'pix' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <RefreshCw size={20} />
                    </div>
                    <span className="font-bold text-slate-700">PIX</span>
                  </div>
                  {selectedPaymentMethod === 'pix' && <CheckCircle2 className="text-sky-600" size={20} />}
                </button>

                <button 
                  onClick={() => {
                    setSelectedPaymentMethod('misto');
                    setAmountReceived(mixedCashAmount);
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${selectedPaymentMethod === 'misto' ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedPaymentMethod === 'misto' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <PieChart size={20} />
                    </div>
                    <span className="font-bold text-slate-700">Pagamento Misto</span>
                  </div>
                  {selectedPaymentMethod === 'misto' && <CheckCircle2 className="text-sky-600" size={20} />}
                </button>
              </div>

              {selectedPaymentMethod === 'dinheiro' && (
                <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Valor Recebido</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        value={amountReceived || ''}
                        onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Troco:</span>
                    <span className={`font-bold ${amountReceived >= cartTotal ? 'text-emerald-600' : 'text-rose-600'}`}>
                      R$ {Math.max(0, amountReceived - cartTotal).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {selectedPaymentMethod === 'misto' && (
                <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Valor em Dinheiro</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        value={mixedCashAmount || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setMixedCashAmount(val);
                          setMixedCardAmount(Math.max(0, cartTotal - val));
                          setAmountReceived(val);
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Valor em Cartão/PIX</label>
                    <div className="relative mb-2">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        value={mixedCardAmount || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setMixedCardAmount(val);
                          setMixedCashAmount(Math.max(0, cartTotal - val));
                          setAmountReceived(Math.max(0, cartTotal - val));
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                      />
                    </div>
                    <select 
                      value={mixedCardMethod}
                      onChange={(e) => setMixedCardMethod(e.target.value as any)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-sky-500"
                    >
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                      <option value="pix">PIX</option>
                    </select>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">Soma:</span>
                    <span className={`font-bold ${(mixedCashAmount + mixedCardAmount).toFixed(2) === cartTotal.toFixed(2) ? 'text-emerald-600' : 'text-rose-600'}`}>
                      R$ {(mixedCashAmount + mixedCardAmount).toFixed(2)}
                    </span>
                  </div>
                  
                  {mixedCashAmount > 0 && (
                    <>
                      <div className="pt-4 border-t border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-1">Valor Recebido (Dinheiro)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            value={amountReceived || ''}
                            onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="pt-2 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-500">Troco:</span>
                        <span className={`font-bold ${amountReceived >= mixedCashAmount ? 'text-emerald-600' : 'text-rose-600'}`}>
                          R$ {Math.max(0, amountReceived - mixedCashAmount).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button 
                onClick={handleCheckout}
                disabled={isProcessingSale}
                className="w-full py-4 bg-sky-600 text-white rounded-xl font-bold text-lg hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessingSale ? (
                  <RefreshCw className="animate-spin" size={24} />
                ) : (
                  <CheckCircle2 size={24} />
                )}
                {isProcessingSale ? 'Processando...' : 'Confirmar Pagamento'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {isReceiptModalOpen && receiptData && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:static print:bg-white print:backdrop-blur-none print:p-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none print:rounded-none"
            >
              <div className="print:hidden flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Comprovante de Venda</h3>
                <button onClick={() => setIsReceiptModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Printable Area */}
              <div id="receipt-content" className="font-mono text-sm text-black bg-white p-4 print:p-0 mx-auto" style={{ maxWidth: '300px' }}>
                <div className="text-center mb-4">
                  <h2 className="font-bold text-lg">{storeSettings.name}</h2>
                  {storeSettings.document && <p className="text-xs">{storeSettings.document}</p>}
                  {storeSettings.address && <p className="text-xs">{storeSettings.address}</p>}
                  {storeSettings.phone && <p className="text-xs">{storeSettings.phone}</p>}
                  <p className="text-xs mt-2 font-bold">RECIBO DE VENDA</p>
                  <p className="text-xs">{new Date(receiptData.date).toLocaleString('pt-BR')}</p>
                </div>

                <div className="border-t border-dashed border-slate-400 my-2"></div>
                
                <table className="w-full text-xs mb-2">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-1">QTD</th>
                      <th className="pb-1">DESCRIÇÃO</th>
                      <th className="text-right pb-1">VL.UN</th>
                      <th className="text-right pb-1">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1 align-top">
                          {item.product.unit === 'kg' ? item.quantity.toFixed(3) : item.quantity}
                        </td>
                        <td className="py-1 align-top pr-1">
                          {item.product.name}
                          {item.discountPercentage ? ` (-${item.discountPercentage}%)` : ''}
                        </td>
                        <td className="py-1 align-top text-right">
                          {item.product.price.toFixed(2)}
                        </td>
                        <td className="py-1 align-top text-right">
                          {(item.product.price * item.quantity * (1 - (item.discountPercentage || 0) / 100)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-dashed border-slate-400 my-2"></div>

                {receiptData.discount !== undefined && receiptData.discount > 0 && (
                  <>
                    <div className="flex justify-between text-xs mb-1">
                      <span>SUBTOTAL R$</span>
                      <span>{receiptData.subtotal?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>DESCONTO R$</span>
                      <span>-{receiptData.discount.toFixed(2)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between font-bold text-base mb-1">
                  <span>TOTAL R$</span>
                  <span>{receiptData.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs mb-4">
                  <span>Forma de Pagamento:</span>
                  <span className="uppercase">{receiptData.paymentMethod.replace('_', ' ')}</span>
                </div>
                {receiptData.amountReceived !== undefined && receiptData.change !== undefined && (
                  <>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Valor Recebido:</span>
                      <span>R$ {receiptData.amountReceived.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-4">
                      <span>Troco:</span>
                      <span>R$ {receiptData.change.toFixed(2)}</span>
                    </div>
                  </>
                )}

                <div className="text-center text-xs mt-4 whitespace-pre-line">
                  {storeSettings.message}
                </div>

                <div className="mt-6 flex flex-col items-center justify-center">
                  <QRCode 
                    value={`RECIBO|${receiptData.date}|${receiptData.total.toFixed(2)}|${receiptData.paymentMethod}`} 
                    size={120} 
                    level="L"
                  />
                  <p className="text-[10px] mt-2 text-slate-500">Consulte via QR Code</p>
                </div>
              </div>

              <div className="print:hidden mt-8 flex gap-3">
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={handlePrintReceipt}
                  className="flex-[2] py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer size={20} />
                  Imprimir Cupom
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Closed Register Summary Modal */}
      <AnimatePresence>
        {closedRegisterSummary && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6 print:hidden">
                <h3 className="text-2xl font-bold text-slate-900">Resumo do Caixa</h3>
                <button 
                  onClick={() => setClosedRegisterSummary(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div id="register-summary-content" className="space-y-4 font-mono text-sm text-black">
                <div className="text-center mb-6">
                  <h2 className="font-bold text-lg">{storeSettings.name}</h2>
                  <p>FECHAMENTO DE CAIXA</p>
                  <p className="text-xs mt-2">{new Date(closedRegisterSummary.closedAt).toLocaleString('pt-BR')}</p>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Valor Inicial (Troco):</span>
                    <span>R$ {closedRegisterSummary.initialBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vendas (Dinheiro):</span>
                    <span>R$ {closedRegisterSummary.salesMoney.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vendas (Cartão/PIX):</span>
                    <span>R$ {closedRegisterSummary.salesOther.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-4 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>Total Esperado (Caixa):</span>
                    <span>R$ {closedRegisterSummary.expectedBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Valor Informado:</span>
                    <span>R$ {closedRegisterSummary.finalBalance.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between font-bold ${closedRegisterSummary.difference < 0 ? 'text-rose-600' : closedRegisterSummary.difference > 0 ? 'text-emerald-600' : ''}`}>
                    <span>Diferença (Quebra):</span>
                    <span>R$ {closedRegisterSummary.difference.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3 print:hidden">
                <button 
                  onClick={() => setClosedRegisterSummary(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Fechar
                </button>
                <button 
                  onClick={() => {
                    const printContent = document.getElementById('register-summary-content');
                    if (!printContent) return;
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) {
                      alert('Por favor, permita popups para imprimir.');
                      return;
                    }
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Fechamento de Caixa</title>
                          <style>
                            body { font-family: monospace; padding: 20px; color: #000; }
                            .text-center { text-align: center; }
                            .flex { display: flex; }
                            .justify-between { justify-content: space-between; }
                            .font-bold { font-weight: bold; }
                            .text-lg { font-size: 1.125rem; }
                            .text-xs { font-size: 0.75rem; }
                            .mt-2 { margin-top: 0.5rem; }
                            .mb-6 { margin-bottom: 1.5rem; }
                            .pt-4 { padding-top: 1rem; }
                            .space-y-2 > * + * { margin-top: 0.5rem; }
                            .space-y-4 > * + * { margin-top: 1rem; }
                            .border-t { border-top: 1px dashed #ccc; }
                          </style>
                        </head>
                        <body>
                          ${printContent.innerHTML}
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => printWindow.print(), 500);
                  }}
                  className="flex-[2] py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer size={20} />
                  Imprimir Resumo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${active ? 'bg-sky-600 text-white shadow-lg shadow-sky-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      <div className="flex items-center gap-3">
        <span className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-sky-600'} transition-colors`}>{icon}</span>
        <span className="font-semibold">{label}</span>
      </div>
      {badge && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white text-sky-600' : 'bg-sky-100 text-sky-600'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ title, value, trend, trendUp, icon, alert }: { title: string, value: string, trend: string, trendUp: boolean, icon: React.ReactNode, alert?: boolean }) {
  return (
    <div className={`bg-white p-6 rounded-2xl border ${alert ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'} shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-slate-50 rounded-lg">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${trendUp ? 'text-emerald-600' : 'text-slate-500'}`}>
          {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      </div>
      <h4 className="text-slate-500 text-sm font-medium">{title}</h4>
      <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
    </div>
  );
}
