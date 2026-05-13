//+------------------------------------------------------------------+
//|  SeizeBridge.mq4                                                  |
//|  MT4 Bridge Expert Advisor for AceCapital Platform                |
//|                                                                   |
//|  SETUP (Mode Auto — direkomendasikan untuk ratusan akun):         |
//|  1. Copy ke: MetaTrader4/MQL4/Experts/SeizeBridge.mq4            |
//|  2. Compile di MetaEditor (F7)                                    |
//|  3. Set ServerUrl = URL Railway kamu                              |
//|  4. Set EaSecret  = nilai EA_SECRET dari Railway environment      |
//|  5. Kosongkan BridgeToken (biarkan "" — akan di-fetch otomatis)   |
//|  6. Drag ke chart mana saja di tiap MT4 terminal                  |
//|  7. Enable "Allow live trading" & tambahkan ServerUrl ke          |
//|     Tools > Options > Expert Advisors > Allow WebRequest          |
//|                                                                   |
//|  SETUP (Mode Manual — jika tidak pakai EaSecret):                 |
//|  Isi BridgeToken dari AceCapital UI > MT4 Accounts > hover > EA btn |
//+------------------------------------------------------------------+
#property copyright "AceCapital"
#property version   "3.2"
#property strict

#define EA_VERSION "3.2"

// Input parameters
double OP_BALANCE;
bool inProgress = false;


input string  ServerUrl            = "https://acecapital.id"; // Backend server URL
input string  EaSecret             = "12b2d69d4c2cc90248664926b04579872cb28a60f5cd8223"; // EA_SECRET dari Railway env
input string  BridgeToken          = "";    // Bridge token manual (kosongkan jika pakai EaSecret)
input int     PushInterval         = 600;   // Interval push posisi (detik)
input bool    PushHistory          = true;  // Aktifkan push history
input int     HistoryPushInterval  = 3600;  // Interval push history (detik) — pisah dari posisi agar lebih ringan
input int     MaxHistory           = 500;   // Maks trade history per push
input int     HistoryDays          = 90;    // Berapa hari ke belakang saat push pertama (atau setelah restart)

// Global state
datetime gLastPush        = 0;
datetime gLastHistorySent = 0;
datetime gLastHistoryPush = 0;  // kapan terakhir kali history dikirim
string   gActiveToken     = ""; // token yang dipakai (manual atau auto-fetched)
bool     gTokenPending    = false; // true = token belum didapat, retry di timer

// Global Variable key untuk cache token di MT4
string GV_TOKEN_KEY = "";

//--- Init
int OnInit()
{
   GV_TOKEN_KEY = "SeizeBridgeToken_" + IntegerToString(AccountNumber()) + "_" + AccountServer();

   // Prioritas: BridgeToken manual > cached GV > auto-register via EaSecret
   if(StringLen(BridgeToken) > 0)
   {
      gActiveToken = BridgeToken;
      Print("[SeizeBridge] Mode manual. Token dari input parameter.");
   }
   else if(GlobalVariableCheck(GV_TOKEN_KEY))
   {
      // Token sudah di-cache dari sesi sebelumnya — decode dari GV (simpan sebagai checksum index)
      // GV hanya bisa simpan double, jadi kita simpan flag dan ambil dari file
      string cached = ReadTokenFile();
      if(StringLen(cached) == 64)  // SHA256 hex = 64 chars
      {
         gActiveToken = cached;
         Print("[SeizeBridge] Token di-load dari cache. Login=", AccountNumber());
      }
   }
   if(StringLen(gActiveToken) == 0)
   {
      if(StringLen(EaSecret) == 0)
      {
         Alert("[SeizeBridge] Isi BridgeToken ATAU EaSecret! Ambil EaSecret dari Railway environment variables.");
         return(INIT_FAILED);
      }
      // Auto-fetch token dari server
      Print("[SeizeBridge] Mengambil token otomatis dari server...");
      gActiveToken = FetchToken();
      if(StringLen(gActiveToken) == 0)
      {
         // Jangan INIT_FAILED — EA tetap load, retry setiap timer tick
         gTokenPending = true;
         Print("[SeizeBridge] Token belum didapat (koneksi gagal), akan retry setiap ", PushInterval, " detik...");
      }
      else
      {
         // Cache ke file agar tidak perlu fetch ulang setiap restart
         WriteTokenFile(gActiveToken);
         GlobalVariableSet(GV_TOKEN_KEY, 1.0);
         Print("[SeizeBridge] Token berhasil di-fetch dan di-cache. Login=", AccountNumber());
      }
   }

   Print("[SeizeBridge] Mulai. Server=", ServerUrl, " Login=", AccountNumber());

   // Timer fallback — push tetap berjalan meski tidak ada tick (weekend/pasar sepi)
   EventSetTimer(PushInterval);

   return(INIT_SUCCEEDED);
}

//--- Auto-fetch token dari endpoint ea-autoregister
string FetchToken()
{
   string url     = ServerUrl + "/api/mt4/ea-autoregister";
   string headers = "Content-Type: application/json\r\n";
   char   postData[];
   char   resultData[];
   string resultHeaders;

   string login  = IntegerToString(AccountNumber());
   string server = AccountServer();
   string payload = "{\"ea_secret\":\"" + EaSecret + "\",\"login\":\"" + login + "\",\"server\":\"" + EscapeJson(server) + "\"}";

   StringToCharArray(payload, postData, 0, StringLen(payload));

   int res = WebRequest("POST", url, headers, 10000, postData, resultData, resultHeaders);
   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Alert("[SeizeBridge] URL belum di-whitelist! Tambahkan '" + ServerUrl + "' di MT4: Tools > Options > Expert Advisors > Allow WebRequest. Lalu RESTART MT4.");
      else
         Alert("[SeizeBridge] WebRequest gagal! Error code: " + IntegerToString(err) + ". Cek koneksi internet.");
      Print("[SeizeBridge] FetchToken WebRequest error=", err);
      return("");
   }
   if(res != 200)
   {
      string body = CharArrayToString(resultData);
      Alert("[SeizeBridge] Server error HTTP=" + IntegerToString(res) + " Body=" + StringSubstr(body,0,100));
      Print("[SeizeBridge] FetchToken gagal. HTTP=", res, " Body=", body);
      return("");
   }

   string body = CharArrayToString(resultData);
   // Parse "bridge_token" dari JSON response sederhana
   int idx = StringFind(body, "\"bridge_token\":\"");
   if(idx < 0) { Print("[SeizeBridge] FetchToken: bridge_token tidak ditemukan dalam response"); return(""); }
   idx += 16;  // skip past "bridge_token":"
   int end = StringFind(body, "\"", idx);
   if(end < 0) return("");
   return StringSubstr(body, idx, end - idx);
}

//--- Simpan token ke file lokal MT4 (MQL4/Files/)
void WriteTokenFile(string token)
{
   string fname = "SeizeBridge_" + IntegerToString(AccountNumber()) + "_" + AccountServer() + ".tkn";
   int h = FileOpen(fname, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(h != INVALID_HANDLE) { FileWriteString(h, token); FileClose(h); }
}

string ReadTokenFile()
{
   string fname = "SeizeBridge_" + IntegerToString(AccountNumber()) + "_" + AccountServer() + ".tkn";
   if(!FileIsExist(fname)) return("");
   int h = FileOpen(fname, FILE_READ | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE) return("");
   string token = FileReadString(h);
   FileClose(h);
   return token;
}

//--- Deinit
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[SeizeBridge] Berhenti. Reason=", reason);
}

//--- Timer: push data meski tidak ada tick (weekend/pasar sepi)
void OnTimer()
{
   // MT4 single-threaded: OnTimer tidak akan interrupt OnTick, tapi guard ini
   // mencegah re-entry jika ada panggilan manual atau nested call
   if(inProgress) return;
   gLastPush = 0;  // reset agar OnTick langsung push saat dipanggil
   OnTick();
}

//--- Tick: push data setiap PushInterval detik
void OnTick()
{
   if(inProgress) return;
   inProgress = true;

   // Retry fetch token jika belum berhasil saat init
   if(gTokenPending)
   {
      Print("[SeizeBridge] Retry mengambil token...");
      string t = FetchToken();
      if(StringLen(t) > 0)
      {
         gActiveToken  = t;
         gTokenPending = false;
         WriteTokenFile(gActiveToken);
         GlobalVariableSet(GV_TOKEN_KEY, 1.0);
         Print("[SeizeBridge] Token berhasil didapat setelah retry. Login=", AccountNumber());
      }
      else
      {
         Print("[SeizeBridge] Retry token gagal, coba lagi nanti...");
         inProgress = false;
         return;
      }
   }

   if(TimeLocal() - gLastPush < PushInterval) { inProgress = false; return; }
   gLastPush = TimeLocal();

   string posJson  = BuildPositionsJson();
   string histJson = "[]";
   bool   sendingHistory = false;

   // Push history hanya setiap HistoryPushInterval detik — bukan setiap push posisi
   // Ini membuat payload regular lebih kecil sehingga MT4 tidak sering Not Responding
   if(PushHistory && (gLastHistoryPush == 0 || TimeLocal() - gLastHistoryPush >= HistoryPushInterval))
   {
      // PENTING: fromTime harus pakai TimeCurrent() (server time) karena
      // OrderCloseTime() juga pakai server time. TimeLocal() berbeda timezone
      // dengan server broker (misal: WIB UTC+7 vs Exness EET UTC+3 = selisih 4 jam),
      // yang menyebabkan semua history baru terfilter keluar setelah push pertama.
      datetime fromTime = (gLastHistorySent == 0)
                          ? TimeCurrent() - HistoryDays * 86400
                          : gLastHistorySent - 300;  // 5 menit buffer agar tidak ada yang terlewat
      histJson       = BuildHistoryJson(fromTime);
      sendingHistory = true;
      // NOTE: gLastHistorySent dan gLastHistoryPush di-update SETELAH push sukses
      // agar jika push gagal (timeout/server error), history dicoba ulang berikutnya
   }

   string login  = IntegerToString(AccountNumber());
   string server = AccountServer();

   string payload = "{";
   payload += "\"token\":\""       + gActiveToken + "\"";
   payload += ",\"login\":\""      + login + "\"";
   payload += ",\"server\":\""     + EscapeJson(server) + "\"";
   payload += ",\"account_info\":{";
   payload += "\"balance\":"       + SafeNum(AccountBalance(),    2);
   payload += ",\"equity\":"       + SafeNum(AccountEquity(),     2);
   payload += ",\"margin\":"       + SafeNum(AccountMargin(),     2);
   payload += ",\"freeMargin\":"   + SafeNum(AccountFreeMargin(), 2);
   payload += ",\"profit\":"       + SafeNum(AccountProfit(),     2);
   payload += ",\"name\":\""       + EscapeJson(AccountName())    + "\"";
   payload += ",\"broker\":\""     + EscapeJson(AccountCompany()) + "\"";
   payload += ",\"currency\":\""   + AccountCurrency()            + "\"";
   payload += ",\"leverage\":"     + IntegerToString(AccountLeverage());
   payload += "}";
   payload += ",\"positions\":"    + posJson;
   payload += ",\"history\":"      + histJson;
   payload += "}";

   bool pushOk = SendPush(payload);
   // Hanya maju gLastHistorySent jika push berhasil — jika gagal, retry di interval berikutnya
   if(pushOk && sendingHistory)
   {
      gLastHistorySent = TimeCurrent(); // server time — harus konsisten dengan OrderCloseTime()
      gLastHistoryPush = TimeLocal();   // local time — untuk interval check (TimeLocal() - gLastHistoryPush)
   }
   inProgress = false;
}

//--- Kirim HTTP POST ke backend — returns true jika HTTP 200
bool SendPush(string payload)
{
   string url     = ServerUrl + "/api/mt4/push";
   string headers = "Content-Type: application/json\r\n";
   char   postData[];
   char   resultData[];
   string resultHeaders;

   StringToCharArray(payload, postData, 0, StringLen(payload));
   // NOTE: jangan ArrayResize(-1) — count eksplisit tidak menambah null terminator,
   // jadi resize akan memotong byte real (penutup '}' JSON)

   // Timeout 2500ms — lebih singkat agar MT4 tidak freeze lama jika server lambat/cold start
   int res = WebRequest("POST", url, headers, 2500, postData, resultData, resultHeaders);

   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Print("[SeizeBridge] URL belum di-whitelist! Tambahkan '", ServerUrl,
               "' di MT4: Tools > Options > Expert Advisors > Allow WebRequest.");
      else
         Print("[SeizeBridge] WebRequest gagal. Error=", err);
      return false;
   }

   if(res != 200)
   {
      Print("[SeizeBridge] Push gagal. HTTP=", res,
            " Response=", CharArrayToString(resultData));
      return false;
   }

   Print("[SeizeBridge] Push OK. Positions=", OrdersTotal());
   return true;
}

//--- Bangun JSON array posisi — sudah di-aggregate per symbol+type
//    Frontend hanya butuh total lot & profit per grup, bukan per-ticket
//    Ini mengurangi ukuran payload dari N baris menjadi M grup (M << N)
string BuildPositionsJson()
{
   // Kumpulkan unik symbol+type
   string symbols[100];
   string types[100];
   double aggLots[100];
   double aggWeightedPrice[100]; // sum(openPrice * lots) untuk hitung avg
   double aggCurrentPrice[100];
   double aggProfit[100];
   double aggSwap[100];
   int    aggCount[100];
   int    groupCount = 0;

   for(int i = 0; i < OrdersTotal(); i++)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderType() > OP_SELL) continue;

      string sym  = OrderSymbol();
      string typ  = TypeToStr(OrderType());
      double lots = OrderLots();
      double curP = (OrderType() == OP_BUY)
                    ? MarketInfo(sym, MODE_BID)
                    : MarketInfo(sym, MODE_ASK);

      // Cari grup yang sudah ada
      int g = -1;
      for(int j = 0; j < groupCount; j++)
      {
         if(symbols[j] == sym && types[j] == typ) { g = j; break; }
      }
      // Buat grup baru jika belum ada (maks 100 grup)
      if(g < 0 && groupCount < 100)
      {
         g = groupCount++;
         symbols[g]          = sym;
         types[g]            = typ;
         aggLots[g]          = 0;
         aggWeightedPrice[g] = 0;
         aggCurrentPrice[g]  = 0;
         aggProfit[g]        = 0;
         aggSwap[g]          = 0;
         aggCount[g]         = 0;
      }
      if(g < 0) continue; // overflow guard

      aggWeightedPrice[g] += OrderOpenPrice() * lots;
      aggLots[g]          += lots;
      aggProfit[g]        += OrderProfit();
      aggSwap[g]          += OrderSwap();
      aggCurrentPrice[g]   = curP; // harga terakhir sudah cukup
      aggCount[g]++;
   }

   // Serialize grup ke JSON — hanya field yang dibutuhkan frontend
   string arr  = "[";
   bool   first = true;
   for(int j = 0; j < groupCount; j++)
   {
      if(!first) arr += ",";
      first = false;
      double avgOpenPrice = (aggLots[j] > 0) ? aggWeightedPrice[j] / aggLots[j] : 0;
      arr += "{";
      arr += "\"symbol\":\""      + EscapeJson(symbols[j]) + "\"";
      arr += ",\"type\":\""       + types[j] + "\"";
      arr += ",\"count\":"        + IntegerToString(aggCount[j]);
      arr += ",\"lots\":"         + SafeNum(aggLots[j],         2);
      arr += ",\"openPrice\":"    + SafeNum(avgOpenPrice,        5);
      arr += ",\"currentPrice\":" + SafeNum(aggCurrentPrice[j],  5);
      arr += ",\"profit\":"       + SafeNum(aggProfit[j],        2);
      arr += ",\"swap\":"         + SafeNum(aggSwap[j],          2);
      arr += "}";
   }
   arr += "]";
   return arr;
}

//--- Bangun JSON array trade history
string BuildHistoryJson(datetime fromTime)
{
   string arr  = "[";
   bool   first = true;

   int count = 0;
   for(int i = OrdersHistoryTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
      if(OrderCloseTime() < fromTime) continue;
      // Include BUY, SELL, and BALANCE (type 6) — skip pending orders and CREDIT
      int ot = OrderType();
      if(ot != OP_BUY && ot != OP_SELL && ot != 6) continue;
      if(MaxHistory > 0 && count >= MaxHistory) break;

      if(!first) arr += ",";
      first = false;
      count++;

      string typeStr = TypeToStr(ot);

      arr += "{";
      arr += "\"ticket\":"      + IntegerToString(OrderTicket());
      arr += ",\"symbol\":\""   + EscapeJson(OrderSymbol()) + "\"";
      arr += ",\"type\":\""     + typeStr + "\"";
      arr += ",\"lots\":"       + SafeNum(OrderLots(),       2);
      arr += ",\"openPrice\":"  + SafeNum(OrderOpenPrice(),  5);
      arr += ",\"closePrice\":" + SafeNum(OrderClosePrice(), 5);
      arr += ",\"stopLoss\":"   + SafeNum(OrderStopLoss(),   5);
      arr += ",\"takeProfit\":" + SafeNum(OrderTakeProfit(), 5);
      arr += ",\"profit\":"     + SafeNum(OrderProfit(),     2);
      arr += ",\"commission\":" + SafeNum(OrderCommission(), 2);
      arr += ",\"swap\":"       + SafeNum(OrderSwap(),       2);
      arr += ",\"openTime\":"   + IntegerToString(OrderOpenTime());
      arr += ",\"closeTime\":"  + IntegerToString(OrderCloseTime());
      arr += ",\"comment\":\""  + EscapeJson(OrderComment()) + "\"";
      arr += "}";
   }
   arr += "]";
   return arr;
}

//--- Helper: order type ke string
string TypeToStr(int type)
{
   switch(type)
   {
      case OP_BUY:       return "BUY";
      case OP_SELL:      return "SELL";
      case OP_BUYLIMIT:  return "BUY_LIMIT";
      case OP_SELLLIMIT: return "SELL_LIMIT";
      case OP_BUYSTOP:   return "BUY_STOP";
      case OP_SELLSTOP:  return "SELL_STOP";
      case 6:            return "BALANCE";
      default:           return "UNKNOWN";
   }
}

//--- Helper: escape JSON string - keep ONLY ASCII printable, escape " and \
string EscapeJson(string s)
{
   string result = "";
   int len = StringLen(s);
   for(int i = 0; i < len; i++)
   {
      ushort c = StringGetChar(s, i);
      if(c == 0x22)                  { result += "\\\""; continue; }  // "
      if(c == 0x5C)                  { result += "\\\\"; continue; }  // backslash
      if(c >= 0x20 && c <= 0x7E)     { result += ShortToString(c);   continue; } // printable ASCII
      // strip everything else: control chars, non-ASCII, etc.
   }
   return result;
}

//--- Helper: safe number to string - replaces nan/inf with 0
string SafeNum(double v, int digits)
{
   if(!MathIsValidNumber(v)) return "0";
   return DoubleToString(v, digits);
}
