const API = "/api";
const money = value => "ETB " + Number(value || 0).toLocaleString("en-US", {maximumFractionDigits:2});
const state = { products: [], cart: JSON.parse(localStorage.getItem("sofaCart") || "[]"), category: "", search: "", token: localStorage.getItem("sofaToken") || "", user: JSON.parse(localStorage.getItem("sofaUser") || "null"), authMode: "login" };
const $ = id => document.getElementById(id);
const safe = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
async function request(url, options={}) {
  const headers = {"Content-Type":"application/json", ...(options.headers||{})};
  if(state.token) headers.Authorization = "Bearer " + state.token;
  const response = await fetch(API+url,{...options,headers});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function saveCart(){localStorage.setItem("sofaCart",JSON.stringify(state.cart));renderCart()}
function cartTotal(){return state.cart.reduce((sum,item)=>{const p=state.products.find(x=>x.id===item.productId);return sum+(p?p.price*item.quantity:0)},0)}
function renderProducts(){
  const products=state.products.filter(p=>(!state.category||p.category===state.category)&&(!state.search||(p.name+" "+p.description).toLowerCase().includes(state.search.toLowerCase())));
  $("productGrid").innerHTML=products.length?products.map(p=>`
    <article class="product-card">
      <div class="product-image"><img loading="lazy" src="${safe(p.image_url||"")}" alt="${safe(p.name)}" onerror="this.src='https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80'">
      ${p.featured?'<span class="product-tag">CUSTOMER FAVOURITE</span>':""}</div>
      <div class="product-info"><div class="product-meta"><h3>${safe(p.name)}</h3><span class="price">${money(p.price)}</span></div>
      <p>${safe(p.description||"Made for comfort and everyday living.")}</p>
      <div class="product-actions"><button class="add-button" data-add="${p.id}" ${p.stock<1?"disabled":""}>${p.stock<1?"Out of stock":"Add to bag +"}</button><span class="stock">${p.stock} available</span></div></div>
    </article>`).join(""):'<p class="empty">No sofas found. Try another search.</p>';
  document.querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>addToCart(Number(btn.dataset.add))));
}
async function loadProducts(){
  $("productGrid").innerHTML='<p class="loading">Loading collection…</p>';
  try{state.products=await request("/products");renderProducts();renderCart()}
  catch(err){$("productGrid").innerHTML='<p class="empty">We could not connect to the store. Please check that the server and database are running.</p>'}
}
function addToCart(id){
  const product=state.products.find(p=>p.id===id);if(!product)return;
  const existing=state.cart.find(i=>i.productId===id);
  if(existing){if(existing.quantity>=product.stock)return toast("No more stock available.");existing.quantity++}
  else {if(product.stock<1)return toast("This sofa is out of stock.");state.cart.push({productId:id,quantity:1})}
  saveCart();toast("Added to your bag.");
}
function changeQty(id,delta){
  const item=state.cart.find(i=>i.productId===id),p=state.products.find(x=>x.id===id);if(!item)return;
  item.quantity+=delta;if(item.quantity<1)state.cart=state.cart.filter(i=>i.productId!==id);
  if(p&&item.quantity>p.stock){item.quantity=p.stock;toast("Available stock limit reached.")}
  saveCart();
}
function renderCart(){
  $("cartCount").textContent=state.cart.reduce((n,i)=>n+i.quantity,0);
  $("cartTotal").textContent=money(cartTotal());$("checkoutTotal").textContent=money(cartTotal());
  $("cartItems").innerHTML=state.cart.length?state.cart.map(i=>{const p=state.products.find(x=>x.id===i.productId);if(!p)return"";return `
    <div class="cart-row"><img src="${safe(p.image_url)}" alt=""><div><h4>${safe(p.name)}</h4><small>${money(p.price)}</small><div class="qty-controls"><button data-qty="${p.id}" data-delta="-1">−</button><span>${i.quantity}</span><button data-qty="${p.id}" data-delta="1">+</button></div></div><button class="remove-item" data-remove="${p.id}">Remove</button></div>`}).join(""):'<p class="empty">Your bag is empty.</p>';
  document.querySelectorAll("[data-qty]").forEach(b=>b.addEventListener("click",()=>changeQty(Number(b.dataset.qty),Number(b.dataset.delta))));
  document.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{state.cart=state.cart.filter(i=>i.productId!==Number(b.dataset.remove));saveCart()}));
}
function openCart(){ $("cartOverlay").classList.add("show");$("cartDrawer").classList.add("open")}
function closeCart(){ $("cartOverlay").classList.remove("show");$("cartDrawer").classList.remove("open")}
function openModal(id){$(id).classList.add("show")}
function closeModal(id){$(id).classList.remove("show")}
function setAuthMode(mode){
  state.authMode=mode;const register=mode==="register";
  $("authTitle").textContent=register?"Create account":"Sign in";
  $("authSubmit").textContent=register?"Create account":"Sign in";
  $("nameField").classList.toggle("hidden",!register);
  $("nameField").querySelector("input").required=register;
  $("authSwitch").innerHTML=register?'Already have an account? <button type="button" id="registerSwitch">Sign in</button>':'New here? <button type="button" id="registerSwitch">Create an account</button>';
  $("registerSwitch").onclick=()=>setAuthMode(register?"login":"register");
  $("authMessage").textContent="";
}
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();const form=new FormData(e.target),body=Object.fromEntries(form.entries());
  try{const data=await request("/auth/"+state.authMode,{method:"POST",body:JSON.stringify(body)});state.token=data.token;state.user=data.user;localStorage.setItem("sofaToken",state.token);localStorage.setItem("sofaUser",JSON.stringify(state.user));closeModal("authModal");toast("Welcome, "+state.user.name+"!");}
  catch(err){$("authMessage").textContent=err.message}
});
$("checkoutForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!state.cart.length)return;
  const body=Object.fromEntries(new FormData(e.target).entries());
  body.items=state.cart.map(i=>({productId:i.productId,quantity:i.quantity}));
  try{const data=await request("/orders",{method:"POST",body:JSON.stringify(body)});state.cart=[];saveCart();e.target.reset();closeModal("checkoutModal");closeCart();toast("Order #"+data.orderId+" received. We will contact you.");await loadProducts()}
  catch(err){$("checkoutMessage").textContent=err.message}
});
$("loginOpen").addEventListener("click",()=>{setAuthMode("login");openModal("authModal")});
$("cartOpen").addEventListener("click",openCart);$("cartClose").addEventListener("click",closeCart);$("cartOverlay").addEventListener("click",closeCart);
$("checkoutOpen").addEventListener("click",()=>{if(!state.cart.length)return toast("Your bag is empty.");closeCart();openModal("checkoutModal")});
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
document.querySelectorAll(".modal-backdrop").forEach(el=>el.addEventListener("click",e=>{if(e.target===el)closeModal(el.id)}));
$("filters").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(!b)return;state.category=b.dataset.category;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));renderProducts()});
$("searchInput").addEventListener("input",e=>{state.search=e.target.value;renderProducts()});
$("menuToggle").addEventListener("click",()=>$("nav").classList.toggle("open"));
document.querySelectorAll(".nav a").forEach(a=>a.addEventListener("click",()=>$("nav").classList.remove("open")));
$("year").textContent=new Date().getFullYear();
loadProducts();
