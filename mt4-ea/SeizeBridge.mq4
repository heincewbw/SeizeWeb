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
#property version   "3.1"
#property strict

#define EA_VERSION "3.1"

// Windows API untuk eksekusi batch file (self-update)
#import "shell32.dll"
int ShellExecuteW(int hwnd, string lpOperation, string lpFile, string lpParameters, string lpDirectory, int nShowCmd);
#import

// Input parameters
double OP_BALANCE;
bool inProgress = false;


input string  ServerUrl    = "https://acecapital.id"; // Backend server URL
input string  EaSecret     = "12b2d69d4c2cc90248664926b04579872cb28a60f5cd8223";                       // EA_SECRET dari Railway env (untuk auto-register)
input string  BridgeToken  = "";                       // Bridge token manual (kosongkan jika pakai EaSecret)
input int     PushInterval = 300;                      // Push interval in seconds
input bool    PushHistory  = true;                     // Send trade history
input int     MaxHistory   = 500;                      // Max history trades to send (0 = unlimited)
input int     HistoryDays  = 90;                       // How many days back to send on first push

// Global state
datetime gLastPush        = 0;
datetime gLastHistorySent = 0;
string   gActiveToken     = "";   // token yang dipakai (manual atau auto-fetched)
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

   // Cek update versi EA dari server (non-blocking — jika gagal tetap lanjut)
   CheckForUpdate();

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

//--- Cek update EA dari server, download & replace otomatis jika ada versi baru
void CheckForUpdate()
{
   string url = ServerUrl + "/api/mt4/ea-version";
   char   dummy[], resultData[];
   string resultHeaders;

   int res = WebRequest("GET", url, "", 10000, dummy, resultData, resultHeaders);
   if(res != 200)
   {
      Print("[SeizeBridge] CheckForUpdate: gagal cek versi. HTTP=", res);
      return;
   }

   string body = CharArrayToString(resultData);

   // Parse version
   int idx = StringFind(body, "\"version\":\"");
   if(idx < 0) return;
   idx += 11;
   int end = StringFind(body, "\"", idx);
   if(end < 0) return;
   string serverVersion = StringSubstr(body, idx, end - idx);

   if(serverVersion == EA_VERSION)
   {
      Print("[SeizeBridge] Versi sudah terkini: v", EA_VERSION);
      return;
   }

   // Only auto-update when server has a STRICTLY NEWER version (avoid downgrade)
   if(StringCompare(serverVersion, EA_VERSION) <= 0)
   {
      Print("[SeizeBridge] Versi server (v", serverVersion, ") tidak lebih baru dari v", EA_VERSION, ". Skip update.");
      return;
   }

   Print("[SeizeBridge] Update tersedia: v", EA_VERSION, " -> v", serverVersion, ". Mengunduh...");

   // Parse download URL
   idx = StringFind(body, "\"url\":\"");
   if(idx < 0) return;
   idx += 7;
   end = StringFind(body, "\"", idx);
   if(end < 0) return;
   string downloadUrl = StringSubstr(body, idx, end - idx);

   // Download .ex4 baru
   char dlResult[];
   string dlHeaders;
   res = WebRequest("GET", downloadUrl, "", 60000, dummy, dlResult, dlHeaders);
   if(res != 200)
   {
      Print("[SeizeBridge] Download gagal. HTTP=", res);
      return;
   }

   // Simpan ke MQL4/Files/SeizeBridge_update.ex4
   string updateFile = "SeizeBridge_update.ex4";
   if(FileIsExist(updateFile)) FileDelete(updateFile);
   int h = FileOpen(updateFile, FILE_WRITE | FILE_BIN);
   if(h == INVALID_HANDLE)
   {
      Print("[SeizeBridge] Gagal buka file untuk write update. Error=", GetLastError());
      return;
   }
   FileWriteArray(h, dlResult, 0, ArraySize(dlResult));
   FileClose(h);

   // Buat batch script yang akan copy file setelah EA unload
   string dataPath    = TerminalInfoString(TERMINAL_DATA_PATH);
   string filesPath   = dataPath + "\\MQL4\\Files\\";
   string expertsPath = dataPath + "\\MQL4\\Experts\\";
   string srcPath     = filesPath + updateFile;
   string destPath    = expertsPath + "SeizeBridge.ex4";
   string batFile     = "SeizeBridge_update.bat";
   string batPath     = filesPath + batFile;

   int bh = FileOpen(batFile, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(bh == INVALID_HANDLE)
   {
      Print("[SeizeBridge] Gagal buat batch script update");
      return;
   }
   FileWriteString(bh, "@echo off\r\n");
   FileWriteString(bh, "timeout /t 4 /nobreak > nul\r\n");
   FileWriteString(bh, "copy /Y \"" + srcPath + "\" \"" + destPath + "\"\r\n");
   FileWriteString(bh, "del \"" + srcPath + "\"\r\n");
   FileWriteString(bh, "del \"" + batPath + "\"\r\n");
   FileClose(bh);

   // Eksekusi batch di background
   ShellExecuteW(0, "open", batPath, "", "", 0);

   Print("[SeizeBridge] Update v", serverVersion, " diunduh. EA restart dalam 4 detik... (chart mungkin reload sebentar)");
   ExpertRemove();  // unload EA agar .ex4 bisa di-overwrite, lalu MT4 load ulang otomatis
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
   if(inProgress) return; // guard sederhana
   inProgress = true;

   inProgress = false;
   gLastPush = 0;  // reset agar OnTick langsung push
   OnTick();
}

//--- Tick: push data setiap PushInterval detik
void OnTick()
{
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
         return;
      }
   }

   if(TimeLocal() - gLastPush < PushInterval) return;
   gLastPush = TimeLocal();

   string posJson  = BuildPositionsJson();
   string histJson = "[]";

   if(PushHistory)
   {
      datetime fromTime = (gLastHistorySent == 0)
                          ? TimeLocal() - HistoryDays * 86400
                          : gLastHistorySent;
      histJson          = BuildHistoryJson(fromTime);
      gLastHistorySent  = TimeLocal();
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

   SendPush(payload);
}

//--- Kirim HTTP POST ke backend
void SendPush(string payload)
{
   string url     = ServerUrl + "/api/mt4/push";
   string headers = "Content-Type: application/json\r\n";
   char   postData[];
   char   resultData[];
   string resultHeaders;

   StringToCharArray(payload, postData, 0, StringLen(payload));
   // NOTE: jangan ArrayResize(-1) — count eksplisit tidak menambah null terminator,
   // jadi resize akan memotong byte real (penutup '}' JSON)

   int res = WebRequest("POST", url, headers, 5000, postData, resultData, resultHeaders);

   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Print("[SeizeBridge] URL belum di-whitelist! Tambahkan '", ServerUrl,
               "' di MT4: Tools > Options > Expert Advisors > Allow WebRequest.");
      else
         Print("[SeizeBridge] WebRequest gagal. Error=", err);
      return;
   }

   if(res != 200)
   {
      Print("[SeizeBridge] Push gagal. HTTP=", res,
            " Response=", CharArrayToString(resultData));
      return;
   }

   Print("[SeizeBridge] Push OK. Positions=", OrdersTotal());
}

//--- Bangun JSON array open positions
string BuildPositionsJson()
{
   string arr  = "[";
   bool   first = true;

   for(int i = 0; i < OrdersTotal(); i++)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderType() > OP_SELL) continue;

      if(!first) arr += ",";
      first = false;

      double curPrice = (OrderType() == OP_BUY)
                        ? MarketInfo(OrderSymbol(), MODE_BID)
                        : MarketInfo(OrderSymbol(), MODE_ASK);

      arr += "{";
      arr += "\"ticket\":"        + IntegerToString(OrderTicket());
      arr += ",\"symbol\":\""     + EscapeJson(OrderSymbol()) + "\"";
      arr += ",\"type\":\""       + TypeToStr(OrderType()) + "\"";
      arr += ",\"lots\":"         + SafeNum(OrderLots(),        2);
      arr += ",\"openPrice\":"    + SafeNum(OrderOpenPrice(),   5);
      arr += ",\"currentPrice\":" + SafeNum(curPrice,           5);
      arr += ",\"stopLoss\":"     + SafeNum(OrderStopLoss(),    5);
      arr += ",\"takeProfit\":"   + SafeNum(OrderTakeProfit(),  5);
      arr += ",\"profit\":"       + SafeNum(OrderProfit(), 2);
      arr += ",\"swap\":"          + SafeNum(OrderSwap(),   2);
      arr += ",\"openTime\":"     + IntegerToString(OrderOpenTime());
      arr += ",\"comment\":\"\"";
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
