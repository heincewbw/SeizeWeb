//+------------------------------------------------------------------+
//|  SeizeBridge.mq4                                                  |
//|  MT4 Bridge Expert Advisor for SeizeWeb Platform                  |
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
//|  Isi BridgeToken dari SeizeWeb UI > MT4 Accounts > hover > EA btn |
//+------------------------------------------------------------------+
#property copyright "SeizeWeb"
#property version   "2.2"
#property strict

// Windows API untuk replace file saat self-update
#import "kernel32.dll"
  bool MoveFileExW(string lpExistingFileName, string lpNewFileName, int dwFlags);
#import

const string EA_VERSION              = "2.2";
const int    MOVEFILE_REPLACE_EXISTING = 1;
const int    MOVEFILE_COPY_ALLOWED     = 2;

// Input parameters
input string  ServerUrl    = "https://seizeweb-production.up.railway.app"; // Backend server URL
input string  EaSecret     = "";                       // EA_SECRET dari Railway env (untuk auto-register)
input string  BridgeToken  = "";                       // Bridge token manual (kosongkan jika pakai EaSecret)
input int     PushInterval = 300;                      // Push interval in seconds
input bool    PushHistory  = true;                     // Send trade history
input int     MaxHistory   = 500;                      // Max history trades to send (0 = unlimited)
input int     HistoryDays  = 90;                       // How many days back to send on first push
input bool    CentsAccount = true;                     // Divide all monetary values by 100 (cents accounts)

// Global state
datetime gLastPush        = 0;
datetime gLastHistorySent = 0;
double   gDivisor         = 1.0;
string   gActiveToken     = "";   // token yang dipakai (manual atau auto-fetched)

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
         Alert("[SeizeBridge] Gagal mengambil token otomatis! Cek ServerUrl dan EaSecret.");
         return(INIT_FAILED);
      }
      // Cache ke file agar tidak perlu fetch ulang setiap restart
      WriteTokenFile(gActiveToken);
      GlobalVariableSet(GV_TOKEN_KEY, 1.0);
      Print("[SeizeBridge] Token berhasil di-fetch dan di-cache. Login=", AccountNumber());
   }

   // Cek apakah ada versi EA terbaru di server, download & restart jika ada
   CheckForUpdate();

   Print("[SeizeBridge] Mulai. Server=", ServerUrl, " Login=", AccountNumber());
   return(INIT_SUCCEEDED);
}

//--- Cek dan download versi EA terbaru dari server
void CheckForUpdate()
{
   string url = ServerUrl + "/ea/ea-version.json";
   string headers = "";
   char   postData[], resultData[];
   string resultHeaders;

   int res = WebRequest("GET", url, headers, 10000, postData, resultData, resultHeaders);
   if(res != 200)
   {
      Print("[SeizeBridge] Cek update gagal. HTTP=", res);
      return;
   }

   string body = CharArrayToString(resultData);

   // Parse "version" field dari JSON
   int idx = StringFind(body, "\"version\":\"");
   if(idx < 0) return;
   idx += 11;
   int end = StringFind(body, "\"", idx);
   if(end < 0) return;
   string serverVersion = StringSubstr(body, idx, end - idx);

   if(serverVersion == EA_VERSION)
   {
      Print("[SeizeBridge] EA sudah versi terbaru (v", EA_VERSION, ")");
      return;
   }

   // Parse download URL
   int urlIdx = StringFind(body, "\"url\":\"");
   if(urlIdx < 0) return;
   urlIdx += 7;
   int urlEnd = StringFind(body, "\"", urlIdx);
   if(urlEnd < 0) return;
   string downloadUrl = StringSubstr(body, urlIdx, urlEnd - urlIdx);

   Print("[SeizeBridge] Update tersedia: v", EA_VERSION, " -> v", serverVersion, ". Mengunduh...");

   // Download .ex4 baru
   char dlData[], emptyPost[];
   string dlHeaders;
   int dlRes = WebRequest("GET", downloadUrl, "", 30000, emptyPost, dlData, dlHeaders);
   if(dlRes != 200 || ArraySize(dlData) == 0)
   {
      Print("[SeizeBridge] Download EA baru gagal. HTTP=", dlRes);
      return;
   }

   // Tulis ke MQL4/Files/ (sementara)
   string tempFile = "SeizeBridge_update.ex4";
   int h = FileOpen(tempFile, FILE_WRITE | FILE_BIN);
   if(h == INVALID_HANDLE)
   {
      Print("[SeizeBridge] Gagal buat file temp. Error=", GetLastError());
      return;
   }
   FileWriteArray(h, dlData, 0, ArraySize(dlData));
   FileClose(h);

   // Pindahkan dari MQL4/Files/ ke MQL4/Experts/ (timpa file lama)
   string dataPath = TerminalInfoString(TERMINAL_DATA_PATH);
   string srcPath  = dataPath + "\\MQL4\\Files\\" + tempFile;
   string dstPath  = dataPath + "\\MQL4\\Experts\\SeizeBridge.ex4";

   bool moved = MoveFileExW(srcPath, dstPath, MOVEFILE_REPLACE_EXISTING | MOVEFILE_COPY_ALLOWED);
   if(!moved)
   {
      Print("[SeizeBridge] Gagal replace file EA. Copy manual: MQL4/Files/",
            tempFile, " -> MQL4/Experts/SeizeBridge.ex4");
      return;
   }

   Print("[SeizeBridge] Update v", serverVersion, " berhasil! Restarting EA...");
   ExpertRemove();
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
   if(res != 200)
   {
      string body = CharArrayToString(resultData);
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
   Print("[SeizeBridge] Berhenti. Reason=", reason);
}

//--- Tick: push data setiap PushInterval detik
void OnTick()
{
   if(TimeCurrent() - gLastPush < PushInterval) return;
   gLastPush = TimeCurrent();
   gDivisor = CentsAccount ? 100.0 : 1.0;

   string posJson  = BuildPositionsJson();
   string histJson = "[]";

   if(PushHistory)
   {
      datetime fromTime = (gLastHistorySent == 0)
                          ? TimeCurrent() - HistoryDays * 86400
                          : gLastHistorySent;
      histJson          = BuildHistoryJson(fromTime);
      gLastHistorySent  = TimeCurrent();
   }

   string login  = IntegerToString(AccountNumber());
   string server = AccountServer();

   string payload = "{";
   payload += "\"token\":\""       + gActiveToken + "\"";
   payload += ",\"login\":\""      + login + "\"";
   payload += ",\"server\":\""     + EscapeJson(server) + "\"";
   payload += ",\"account_info\":{";
   double divisor = gDivisor;
   payload += "\"balance\":"       + SafeNum(AccountBalance()    / divisor, 2);
   payload += ",\"equity\":"       + SafeNum(AccountEquity()     / divisor, 2);
   payload += ",\"margin\":"       + SafeNum(AccountMargin()     / divisor, 2);
   payload += ",\"freeMargin\":"   + SafeNum(AccountFreeMargin() / divisor, 2);
   payload += ",\"profit\":"       + SafeNum(AccountProfit()     / divisor, 2);
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
      arr += ",\"profit\":"       + SafeNum(OrderProfit() / gDivisor, 2);
      arr += ",\"swap\":"         + SafeNum(OrderSwap()   / gDivisor, 2);
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
      arr += ",\"profit\":"     + SafeNum(OrderProfit()     / gDivisor, 2);
      arr += ",\"commission\":" + SafeNum(OrderCommission() / gDivisor, 2);
      arr += ",\"swap\":"       + SafeNum(OrderSwap()       / gDivisor, 2);
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
