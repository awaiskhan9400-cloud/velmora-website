import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://umzxypaoccgcplluvwrg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TouM2LcIVLhzcxD4shW1oA_cUHVRo1Y';
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const RED = '#c8102e', BG = '#050505', PANEL = '#111111', MUTED = '#aaa39b';
const categories = ['Fashion','Electronics','Home Essentials','Beauty & Care','Audio','Bags & Accessories','Fitness'];
const money = n => 'PKR ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });

export default function App() {
  const [mode, setMode] = useState('shop');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [admin, setAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [variants, setVariants] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [photos, setPhotos] = useState([]);
  const [published, setPublished] = useState(true);

  useEffect(() => { loadProducts(); }, []);
  async function loadProducts() {
    setLoading(true);
    const { data, error } = await db.from('velmora_products').select('*').order('created_at', { ascending: false });
    if (error) Alert.alert('Catalogue error', error.message);
    else setProducts(data || []);
    setLoading(false);
  }
  async function signIn() {
    if (!email.trim() || !password) return Alert.alert('Sign in', 'Enter your admin email and password.');
    setBusy(true);
    const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setBusy(false); return Alert.alert('Sign-in failed', error.message); }
    const { data: approved, error: checkError } = await db.from('velmora_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (checkError || !approved) {
      await db.auth.signOut(); setBusy(false);
      return Alert.alert('Access denied', 'This account is not an approved Velmora administrator.');
    }
    setSignedIn(true); setAdmin(true); setBusy(false); setMode('manage'); await loadProducts();
  }
  async function signOut() { await db.auth.signOut(); setSignedIn(false); setAdmin(false); setMode('shop'); resetForm(); }
  function resetForm() {
    setEditingId(''); setTitle(''); setPrice(''); setCategory(categories[0]); setVariants('');
    setDescription(''); setImageUrl(''); setPhotos([]); setPublished(true);
  }
  function editProduct(p) {
    setEditingId(p.id); setTitle(p.title || ''); setPrice(String(p.price ?? '')); setCategory(p.category || categories[0]);
    setVariants(Array.isArray(p.variants) ? p.variants.join(', ') : '');
    setDescription(p.description || ''); setImageUrl(p.image || '');
    setPhotos((p.images || []).filter(u => u && u !== p.image).map(uri => ({ uri, existing: true })));
    setPublished(!!p.published);
    setMode('manage');
  }
  async function choosePhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.82, selectionLimit: 6 });
    if (!result.canceled) setPhotos(prev => [...prev, ...result.assets].slice(0, 6));
  }
  async function uploadPhotos(handle) {
    const urls = photos.filter(p => p.existing).map(p => p.uri);
    for (const p of photos.filter(p => !p.existing)) {
      const ext = (p.fileName?.split('.').pop() || p.uri.split('.').pop()?.split('?')[0] || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
      const path = handle + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const base64 = await FileSystem.readAsStringAsync(p.uri, { encoding: FileSystem.EncodingType.Base64 });
      const { error } = await db.storage.from('velmora-products').upload(path, decode(base64), { contentType: p.mimeType || 'image/jpeg', upsert: false });
      if (error) throw error;
      urls.push(db.storage.from('velmora-products').getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }
  async function saveProduct() {
    if (!admin) return Alert.alert('Admin only', 'Sign in with your approved admin account first.');
    if (!title.trim() || price === '' || Number(price) < 0) return Alert.alert('Missing details', 'Enter a product name and a valid price.');
    setBusy(true);
    try {
      let handle = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150) || 'product';
      const duplicate = products.find(p => p.handle === handle && p.id !== editingId);
      if (duplicate) handle += '-' + Date.now().toString().slice(-5);
      const uploaded = await uploadPhotos(handle);
      const primary = imageUrl.trim() || uploaded[0] || '';
      const allImages = [...new Set([primary, ...uploaded].filter(Boolean))];
      if (!primary) throw new Error('Choose a product photo or enter an image URL.');
      const record = { title: title.trim(), handle, price: Number(price), category, description: description.trim(), variants: variants.split(',').map(v => v.trim()).filter(Boolean), image: primary, images: allImages, published, updated_at: new Date().toISOString() };
      const result = editingId
        ? await db.from('velmora_products').update(record).eq('id', editingId)
        : await db.from('velmora_products').insert(record);
      if (result.error) throw result.error;
      Alert.alert('Saved', editingId ? 'Product updated across Velmora.' : 'Product added to the shared catalogue.');
      resetForm(); await loadProducts();
    } catch (e) { Alert.alert('Could not save product', e.message || 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function togglePublished(p) {
    const { error } = await db.from('velmora_products').update({ published: !p.published, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) Alert.alert('Update failed', error.message); else await loadProducts();
  }
  function deleteProduct(p) {
    Alert.alert('Delete product?', 'This permanently removes ' + p.title + ' from the shared catalogue.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await db.from('velmora_products').delete().eq('id', p.id);
        if (error) Alert.alert('Delete failed', error.message); else { if (editingId === p.id) resetForm(); await loadProducts(); }
      }}
    ]);
  }
  const visibleProducts = products.filter(p => (mode === 'manage' && admin ? true : p.published) && ((p.title + ' ' + p.category + ' ' + (p.description || '')).toLowerCase().includes(search.toLowerCase())));
  const Button = ({ label, onPress, secondary = false, disabled = false }) => (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, secondary && styles.secondaryButton, disabled && { opacity: 0.55 }]}>
      <Text style={[styles.buttonText, secondary && { color: '#f5f2ee' }]}>{label}</Text>
    </Pressable>
  );
  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="light-content" backgroundColor={BG} />
    <View style={styles.header}>
      <View><Text style={styles.brand}>VELMORA</Text><Text style={styles.subbrand}>SMART FINDS · EVERYDAY LUXURY</Text></View>
      {signedIn ? <Pressable onPress={signOut}><Text style={styles.headerAction}>SIGN OUT</Text></Pressable> : <Pressable onPress={() => setMode(mode === 'login' ? 'shop' : 'login')}><Text style={styles.headerAction}>{mode === 'login' ? 'SHOP' : 'ADMIN'}</Text></Pressable>}
    </View>
    <View style={styles.tabs}>
      <Pressable onPress={() => setMode('shop')} style={[styles.tab, mode === 'shop' && styles.activeTab]}><Text style={styles.tabText}>SHOP</Text></Pressable>
      <Pressable onPress={() => setMode(admin ? 'manage' : 'login')} style={[styles.tab, ['manage','login'].includes(mode) && styles.activeTab]}><Text style={styles.tabText}>PRODUCT MANAGEMENT</Text></Pressable>
    </View>
    {mode === 'login' && !admin ? <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.loginWrap}>
      <Text style={styles.heading}>Administrator sign in</Text><Text style={styles.muted}>Use your existing approved Velmora admin account.</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Admin email" placeholderTextColor={MUTED} autoCapitalize="none" keyboardType="email-address" style={styles.input}/>
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={MUTED} secureTextEntry style={styles.input}/>
      <Button label={busy ? 'SIGNING IN…' : 'SIGN IN SECURELY'} onPress={signIn} disabled={busy}/>
    </KeyboardAvoidingView> : <FlatList
      data={visibleProducts}
      keyExtractor={item => item.id}
      numColumns={2}
      refreshing={loading}
      onRefresh={loadProducts}
      ListHeaderComponent={<View>
        <View style={styles.hero}><Text style={styles.eyebrow}>{mode === 'manage' && admin ? 'YOUR SHARED CATALOGUE' : 'DISCOVER YOUR EVERYDAY ESSENTIALS'}</Text><Text style={styles.heroTitle}>{mode === 'manage' && admin ? 'Manage products' : 'Find your next favourite.'}</Text><Text style={styles.muted}>{mode === 'manage' && admin ? 'Changes sync to the website and app through one database.' : 'Smart finds, stylish essentials, and everyday products — all in one place.'}</Text></View>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search products and categories" placeholderTextColor={MUTED} style={styles.search}/>
        {mode === 'manage' && admin ? <View style={styles.form}>
          <Text style={styles.heading}>{editingId ? 'Edit product' : 'Add a product'}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Product name *" placeholderTextColor={MUTED} style={styles.input}/>
          <TextInput value={price} onChangeText={setPrice} placeholder="Price in PKR *" placeholderTextColor={MUTED} keyboardType="decimal-pad" style={styles.input}/>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>{categories.map(c => <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}><Text style={styles.chipText}>{c}</Text></Pressable>)}</ScrollView>
          <TextInput value={variants} onChangeText={setVariants} placeholder="Sizes / colours, comma separated" placeholderTextColor={MUTED} style={styles.input}/>
          <TextInput value={description} onChangeText={setDescription} placeholder="Product description" placeholderTextColor={MUTED} multiline style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}/>
          <TextInput value={imageUrl} onChangeText={setImageUrl} placeholder="Primary image URL (optional if uploading)" placeholderTextColor={MUTED} autoCapitalize="none" style={styles.input}/>
          <Button label={'CHOOSE PHOTOS (' + photos.length + ')'} onPress={choosePhotos} secondary/>
          {photos.length > 0 ? <ScrollView horizontal style={{ marginVertical: 10 }}>{photos.map((p, i) => <View key={p.uri + i} style={{ marginRight: 8 }}><Image source={{ uri: p.uri }} style={styles.preview}/><Pressable onPress={() => setPhotos(old => old.filter((_, j) => j !== i))}><Text style={styles.removePhoto}>REMOVE</Text></Pressable></View>)}</ScrollView> : null}
          <Pressable onPress={() => setPublished(v => !v)} style={styles.publishRow}><View style={[styles.checkbox, published && styles.checked]}/><Text style={styles.bodyText}>Publish on website and app</Text></Pressable>
          <Button label={busy ? 'SAVING…' : editingId ? 'SAVE CHANGES' : 'ADD PRODUCT'} onPress={saveProduct} disabled={busy}/>
          {editingId ? <Button label="CANCEL EDIT" onPress={resetForm} secondary/> : null}
          <Text style={styles.mutedSmall}>Product changes are shared with the website. Only approved admins can edit the catalogue.</Text>
        </View> : null}
        <Text style={styles.sectionTitle}>{mode === 'manage' && admin ? 'All products' : 'Shop products'}</Text>
      </View>}
      renderItem={({ item }) => <View style={styles.productCard}>
        <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="contain"/>
        <View style={styles.productInfo}><Text style={styles.productCategory}>{item.category}</Text><Text numberOfLines={2} style={styles.productTitle}>{item.title}</Text><Text style={styles.productPrice}>{money(item.price)}</Text>
          {Array.isArray(item.variants) && item.variants.length ? <Text numberOfLines={2} style={styles.mutedSmall}>{item.variants.join(' · ')}</Text> : null}
          {admin && mode === 'manage' ? <><Text style={[styles.status, item.published ? { color: '#76d39b' } : { color: '#ffb45e' }]}>{item.published ? 'PUBLISHED' : 'HIDDEN'}</Text><Button label="EDIT" onPress={() => editProduct(item)} secondary/><Button label={item.published ? 'HIDE' : 'PUBLISH'} onPress={() => togglePublished(item)} secondary/><Button label="DELETE" onPress={() => deleteProduct(item)} secondary/></> : null}
        </View>
      </View>}
      ListEmptyComponent={<Text style={styles.mutedEmpty}>{loading ? 'Loading catalogue…' : 'No products found.'}</Text>}
      contentContainerStyle={styles.listContent}
    />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:BG}, header:{paddingHorizontal:18,paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#242424',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  brand:{fontSize:23,letterSpacing:5,fontWeight:'600',color:'#f5f2ee'},subbrand:{fontSize:8,letterSpacing:1.6,color:MUTED,marginTop:3},headerAction:{color:'#ff6b81',fontSize:11,letterSpacing:1.2,fontWeight:'700'},
  tabs:{flexDirection:'row',paddingHorizontal:12,borderBottomWidth:1,borderBottomColor:'#242424'},tab:{paddingVertical:13,paddingHorizontal:10,borderBottomWidth:2,borderBottomColor:'transparent'},activeTab:{borderBottomColor:RED},tabText:{color:'#f5f2ee',fontSize:10,letterSpacing:1},
  hero:{paddingHorizontal:18,paddingTop:26,paddingBottom:18},eyebrow:{fontSize:10,color:'#ff6b81',letterSpacing:1.8,marginBottom:9},heroTitle:{fontSize:30,fontWeight:'600',color:'#f5f2ee',lineHeight:36,marginBottom:8},muted:{fontSize:13,color:MUTED,lineHeight:19},search:{marginHorizontal:16,marginBottom:18,backgroundColor:PANEL,color:'#fff',padding:13,borderWidth:1,borderColor:'#292929',borderRadius:8},
  listContent:{paddingBottom:45},productCard:{width:'50%',paddingHorizontal:7,marginBottom:14},productImage:{width:'100%',aspectRatio:0.84,backgroundColor:'#fff',borderRadius:4},productInfo:{paddingTop:10,gap:5},productCategory:{fontSize:9,color:'#ff6b81',letterSpacing:1,textTransform:'uppercase'},productTitle:{fontSize:14,color:'#f5f2ee',lineHeight:19,minHeight:38},productPrice:{fontSize:14,fontWeight:'600',color:'#fff'},sectionTitle:{fontSize:21,color:'#f5f2ee',fontWeight:'500',paddingHorizontal:18,paddingTop:12,paddingBottom:15},
  form:{marginHorizontal:14,marginBottom:20,padding:14,backgroundColor:PANEL,borderWidth:1,borderColor:'#292929',borderRadius:10},heading:{fontSize:21,color:'#f5f2ee',fontWeight:'600',marginBottom:8},input:{backgroundColor:'#080808',borderWidth:1,borderColor:'#303030',borderRadius:7,padding:12,color:'#f5f2ee',marginTop:9,fontSize:14},button:{backgroundColor:RED,paddingVertical:13,paddingHorizontal:12,alignItems:'center',justifyContent:'center',borderRadius:5,marginTop:9},secondaryButton:{backgroundColor:'#191919',borderWidth:1,borderColor:'#383838'},buttonText:{color:'#fff',fontSize:11,fontWeight:'700',letterSpacing:1},chip:{paddingVertical:9,paddingHorizontal:12,borderWidth:1,borderColor:'#333',borderRadius:20,marginRight:7,marginTop:10},chipActive:{backgroundColor:RED,borderColor:RED},chipText:{fontSize:11,color:'#f5f2ee'},publishRow:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:13},checkbox:{width:18,height:18,borderWidth:1,borderColor:'#777',borderRadius:3},checked:{backgroundColor:RED,borderColor:RED},bodyText:{fontSize:13,color:'#f5f2ee'},preview:{width:74,height:74,backgroundColor:'#fff',borderRadius:4},removePhoto:{fontSize:9,color:'#ff6b81',textAlign:'center',marginTop:4},mutedSmall:{fontSize:10,color:MUTED,lineHeight:15,marginTop:4},status:{fontSize:9,letterSpacing:1,marginTop:4},loginWrap:{padding:18},mutedEmpty:{color:MUTED,textAlign:'center',padding:30}
});
