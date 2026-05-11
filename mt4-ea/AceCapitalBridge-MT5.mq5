//+------------------------------------------------------------------+
//|  AceCapitalBridge-MT5.mq5                                         |
//|  MT5 Bridge Expert Advisor for AceCapital Platform                |
//|                                                                   |
//|  SETUP (Mode Auto — direkomendasikan untuk ratusan akun):         |
//|  1. Copy ke: MetaTrader5/MQL5/Experts/AceCapitalBridge-MT5.mq5   |
//|  2. Compile di MetaEditor (F7)                                    |
//|  3. Set ServerUrl = URL Railway kamu                              |
//|  4. Set EaSecret  = nilai EA_SECRET dari Railway environment      |
//|  5. Kosongkan BridgeToken (biarkan "" — akan di-fetch otomatis)   |
//|  6. Drag ke chart mana saja di tiap MT5 terminal                  |
//|  7. Enable "Allow Algo Trading" & tambahkan ServerUrl ke          |
//|     Tools > Options > Expert Advisors > Allow WebRequest For      |
//|                                                                   |
//|  SETUP (Mode Manual — jika tidak pakai EaSecret):                 |
//|  Isi BridgeToken dari AceCapital UI > MT4 Accounts > hover > EA btn |
//+------------------------------------------------------------------+
#property copyright "AceCapital"
#property version   "1.0"

#define EA_VERSION "1.0"

// ── Input parameters ─────────────────────────────────────────────────────────
input string  ServerUrl            = "https://acecapital.id"; // Backend server URL
input string  EaSecret             = "";    // EA_SECRET dari Railway env (untuk auto-register)
input string  BridgeToken          = "";    // Bridge token manual (kosongkan jika pakai EaSecret)
input int     PushInterval         = 300;   // Interval push posisi (detik)
input bool    PushHistory          = true;  // Aktifkan push history
input int     HistoryPushInterval  = 3600;  // Interval push history (detik) — pisah dari posisi
input int     MaxHistory           = 200;   // Maks deal history per push
input int     HistoryDays          = 30;    // Berapa hari ke belakang saat push pertama

// ── Global state ─────────────────────────────────────────────────────────────
datetime gLastPush        = 0;
datetime gLastHistorySent = 0;
datetime gLastHistoryPush = 0;
string   gActiveToken     = "";
bool     gTokenPending    = false;
bool     inProgress       = false;

string GV_TOKEN_KEY = "";

// ── Forward declarations ──────────────────────────────────────────────────────
string FetchToken();
void   WriteTokenFile(string token);
string ReadTokenFile();
string BuildPositionsJson();
string BuildHistoryJson(datetime fromTime);
void   SendPush(string payload);
string EscapeJson(string s);
string SafeNum(double v, int digits);
string DealTypeToStr(ENUM_DEAL_TYPE dt);

//+------------------------------------------------------------------+
//| OnInit                                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   long login  = AccountInfoInteger(ACCOUNT_LOGIN);
   string srv  = AccountInfoString(ACCOUNT_SERVER);
   GV_TOKEN_KEY = "AceCapitalBridgeToken_" + IntegerToString(login) + "_" + srv;

   // Prioritas: BridgeToken manual > cached file > auto-register via EaSecret
   if(StringLen(BridgeToken) > 0)
   {
      gActiveToken = BridgeToken;
      Print("[AceCapitalBridge-MT5] Mode manual. Token dari input parameter.");
   }
   else if(GlobalVariableCheck(GV_TOKEN_KEY))
   {
      string cached = ReadTokenFile();
      if(StringLen(cached) == 64)
      {
         gActiveToken = cached;
         Print("[AceCapitalBridge-MT5] Token di-load dari cache. Login=", login);
      }
   }

   if(StringLen(gActiveToken) == 0)
   {
      if(StringLen(EaSecret) == 0)
      {
         Alert("[AceCapitalBridge-MT5] Isi BridgeToken ATAU EaSecret! Ambil EaSecret dari Railway environment variables.");
         return(INIT_FAILED);
      }
      Print("[AceCapitalBridge-MT5] Mengambil token otomatis dari server...");
      gActiveToken = FetchToken();
      if(StringLen(gActiveToken) == 0)
      {
         gTokenPending = true;
         Print("[AceCapitalBridge-MT5] Token belum didapat (koneksi gagal), akan retry setiap ", PushInterval, " detik...");
      }
      else
      {
         WriteTokenFile(gActiveToken);
         GlobalVariableSet(GV_TOKEN_KEY, 1.0);
         Print("[AceCapitalBridge-MT5] Token berhasil di-fetch dan di-cache. Login=", login);
      }
   }

   Print("[AceCapitalBridge-MT5] Mulai. Server=", ServerUrl, " Login=", login);
   EventSetTimer(PushInterval);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| OnDeinit                                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[AceCapitalBridge-MT5] Berhenti. Reason=", reason);
}

//+------------------------------------------------------------------+
//| OnTimer — push saat pasar sepi / tidak ada tick                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(inProgress) return;
   gLastPush = 0;
   OnTick();
}

//+------------------------------------------------------------------+
//| OnTick — push setiap PushInterval detik                           |
//+------------------------------------------------------------------+
void OnTick()
{
   if(inProgress) return;
   inProgress = true;

   // Retry fetch token jika belum berhasil saat init
   if(gTokenPending)
   {
      Print("[AceCapitalBridge-MT5] Retry mengambil token...");
      string t = FetchToken();
      if(StringLen(t) > 0)
      {
         gActiveToken  = t;
         gTokenPending = false;
         WriteTokenFile(gActiveToken);
         GlobalVariableSet(GV_TOKEN_KEY, 1.0);
         Print("[AceCapitalBridge-MT5] Token berhasil didapat setelah retry. Login=", AccountInfoInteger(ACCOUNT_LOGIN));
      }
      else
      {
         Print("[AceCapitalBridge-MT5] Retry token gagal, coba lagi nanti...");
         inProgress = false;
         return;
      }
   }

   if(TimeLocal() - gLastPush < PushInterval) { inProgress = false; return; }
   gLastPush = TimeLocal();

   string posJson  = BuildPositionsJson();
   string histJson = "[]";

   // Push history hanya setiap HistoryPushInterval — payload regular lebih ringan
   if(PushHistory && (gLastHistoryPush == 0 || TimeLocal() - gLastHistoryPush >= HistoryPushInterval))
   {
      datetime fromTime = (gLastHistorySent == 0)
                          ? TimeLocal() - HistoryDays * 86400
                          : gLastHistorySent;
      histJson          = BuildHistoryJson(fromTime);
      gLastHistorySent  = TimeLocal();
      gLastHistoryPush  = TimeLocal();
   }

   long   login  = AccountInfoInteger(ACCOUNT_LOGIN);
   string server = AccountInfoString(ACCOUNT_SERVER);

   string payload = "{";
   payload += "\"token\":\""       + gActiveToken + "\"";
   payload += ",\"login\":\""      + IntegerToString(login) + "\"";
   payload += ",\"server\":\""     + EscapeJson(server) + "\"";
   payload += ",\"account_info\":{";
   payload += "\"balance\":"       + SafeNum(AccountInfoDouble(ACCOUNT_BALANCE),     2);
   payload += ",\"equity\":"       + SafeNum(AccountInfoDouble(ACCOUNT_EQUITY),      2);
   payload += ",\"margin\":"       + SafeNum(AccountInfoDouble(ACCOUNT_MARGIN),      2);
   payload += ",\"freeMargin\":"   + SafeNum(AccountInfoDouble(ACCOUNT_FREEMARGIN),  2);
   payload += ",\"profit\":"       + SafeNum(AccountInfoDouble(ACCOUNT_PROFIT),      2);
   payload += ",\"name\":\""       + EscapeJson(AccountInfoString(ACCOUNT_NAME))     + "\"";
   payload += ",\"broker\":\""     + EscapeJson(AccountInfoString(ACCOUNT_COMPANY))  + "\"";
   payload += ",\"currency\":\""   + AccountInfoString(ACCOUNT_CURRENCY)             + "\"";
   payload += ",\"leverage\":"     + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE));
   payload += "}";
   payload += ",\"positions\":"    + posJson;
   payload += ",\"history\":"      + histJson;
   payload += "}";

   SendPush(payload);
   inProgress = false;
}

//+------------------------------------------------------------------+
//| Auto-fetch token dari endpoint ea-autoregister                    |
//+------------------------------------------------------------------+
string FetchToken()
{
   string url     = ServerUrl + "/api/mt4/ea-autoregister";
   string headers = "Content-Type: application/json\r\n";
   char   postData[];
   char   resultData[];
   string resultHeaders;

   string login  = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string server = AccountInfoString(ACCOUNT_SERVER);
   string pl = "{\"ea_secret\":\"" + EaSecret + "\",\"login\":\"" + login + "\",\"server\":\"" + EscapeJson(server) + "\"}";

   StringToCharArray(pl, postData, 0, StringLen(pl));

   int res = WebRequest("POST", url, headers, 10000, postData, resultData, resultHeaders);
   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Alert("[AceCapitalBridge-MT5] URL belum di-whitelist! Tambahkan '" + ServerUrl +
               "' di MT5: Tools > Options > Expert Advisors > Allow WebRequest For. Lalu RESTART MT5.");
      else
         Alert("[AceCapitalBridge-MT5] WebRequest gagal! Error code: " + IntegerToString(err) + ". Cek koneksi internet.");
      Print("[AceCapitalBridge-MT5] FetchToken WebRequest error=", err);
      return("");
   }
   if(res != 200)
   {
      string body = CharArrayToString(resultData);
      Alert("[AceCapitalBridge-MT5] Server error HTTP=" + IntegerToString(res) + " Body=" + StringSubstr(body,0,100));
      Print("[AceCapitalBridge-MT5] FetchToken gagal. HTTP=", res, " Body=", body);
      return("");
   }

   string body = CharArrayToString(resultData);
   int idx = StringFind(body, "\"bridge_token\":\"");
   if(idx < 0) { Print("[AceCapitalBridge-MT5] FetchToken: bridge_token tidak ditemukan dalam response"); return(""); }
   idx += 16;
   int end = StringFind(body, "\"", idx);
   if(end < 0) return("");
   return StringSubstr(body, idx, end - idx);
}

//+------------------------------------------------------------------+
//| File cache token (MQL5/Files/)                                    |
//+------------------------------------------------------------------+
void WriteTokenFile(string token)
{
   string fname = "AceCapitalBridge_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) +
                  "_" + AccountInfoString(ACCOUNT_SERVER) + ".tkn";
   int h = FileOpen(fname, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(h != INVALID_HANDLE) { FileWriteString(h, token); FileClose(h); }
}

string ReadTokenFile()
{
   string fname = "AceCapitalBridge_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) +
                  "_" + AccountInfoString(ACCOUNT_SERVER) + ".tkn";
   if(!FileIsExist(fname)) return("");
   int h = FileOpen(fname, FILE_READ | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE) return("");
   string token = FileReadString(h);
   FileClose(h);
   return token;
}

//+------------------------------------------------------------------+
//| Kirim HTTP POST ke backend                                        |
//+------------------------------------------------------------------+
void SendPush(string payload)
{
   string url     = ServerUrl + "/api/mt4/push";
   string headers = "Content-Type: application/json\r\n";
   char   postData[];
   char   resultData[];
   string resultHeaders;

   StringToCharArray(payload, postData, 0, StringLen(payload));

   // Timeout 2500ms — lebih singkat agar MT5 tidak freeze lama jika server lambat/cold start
   int res = WebRequest("POST", url, headers, 2500, postData, resultData, resultHeaders);

   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Print("[AceCapitalBridge-MT5] URL belum di-whitelist! Tambahkan '", ServerUrl,
               "' di MT5: Tools > Options > Expert Advisors > Allow WebRequest For.");
      else
         Print("[AceCapitalBridge-MT5] WebRequest gagal. Error=", err);
      return;
   }
   if(res != 200)
   {
      Print("[AceCapitalBridge-MT5] Push gagal. HTTP=", res,
            " Response=", CharArrayToString(resultData));
      return;
   }
   Print("[AceCapitalBridge-MT5] Push OK. Positions=", PositionsTotal());
}

//+------------------------------------------------------------------+
//| Build JSON array posisi — aggregate per symbol+type               |
//| MT5: pakai PositionGetSymbol / PositionGetDouble / GetInteger     |
//+------------------------------------------------------------------+
string BuildPositionsJson()
{
   string symbols[100];
   string types[100];
   double aggLots[100];
   double aggWeightedPrice[100];
   double aggCurrentPrice[100];
   double aggProfit[100];
   double aggSwap[100];
   int    aggCount[100];
   int    groupCount = 0;

   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      string sym = PositionGetSymbol(i);
      if(sym == "") continue;
      if(!PositionSelectByTicket(PositionGetInteger(POSITION_TICKET))) continue;

      ENUM_POSITION_TYPE pt = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      if(pt != POSITION_TYPE_BUY && pt != POSITION_TYPE_SELL) continue;

      string typ  = (pt == POSITION_TYPE_BUY) ? "BUY" : "SELL";
      double lots = PositionGetDouble(POSITION_VOLUME);
      double op   = PositionGetDouble(POSITION_PRICE_OPEN);
      double curP = PositionGetDouble(POSITION_PRICE_CURRENT);
      double prof = PositionGetDouble(POSITION_PROFIT);
      double swap = PositionGetDouble(POSITION_SWAP);

      // Cari grup yang sudah ada
      int g = -1;
      for(int j = 0; j < groupCount; j++)
         if(symbols[j] == sym && types[j] == typ) { g = j; break; }

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
      if(g < 0) continue;

      aggWeightedPrice[g] += op * lots;
      aggLots[g]          += lots;
      aggProfit[g]        += prof;
      aggSwap[g]          += swap;
      aggCurrentPrice[g]   = curP;
      aggCount[g]++;
   }

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
      arr += ",\"lots\":"         + SafeNum(aggLots[j],        2);
      arr += ",\"openPrice\":"    + SafeNum(avgOpenPrice,       5);
      arr += ",\"currentPrice\":" + SafeNum(aggCurrentPrice[j], 5);
      arr += ",\"profit\":"       + SafeNum(aggProfit[j],       2);
      arr += ",\"swap\":"         + SafeNum(aggSwap[j],         2);
      arr += "}";
   }
   arr += "]";
   return arr;
}

//+------------------------------------------------------------------+
//| Build JSON array deal history                                     |
//| MT5: HistorySelect + HistoryDealGetXxx                            |
//+------------------------------------------------------------------+
string BuildHistoryJson(datetime fromTime)
{
   if(!HistorySelect(fromTime, TimeCurrent())) return "[]";

   string arr  = "[";
   bool   first = true;
   int    count = 0;
   int    total = HistoryDealsTotal();

   // Iterate newest-first untuk match MaxHistory dari trade terbaru
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;

      // Hanya ambil deal ENTRY (IN) atau balance — skip partial close (OUT) agar
      // tidak duplikat dengan transaksi yang sama
      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket, DEAL_ENTRY);
      ENUM_DEAL_TYPE  dt    = (ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket, DEAL_TYPE);

      // Include: BUY_IN, SELL_IN, BALANCE, CREDIT — skip all others
      bool isBalance = (dt == DEAL_TYPE_BALANCE || dt == DEAL_TYPE_CREDIT);
      bool isTrade   = (entry == DEAL_ENTRY_IN) &&
                       (dt == DEAL_TYPE_BUY || dt == DEAL_TYPE_SELL);
      if(!isBalance && !isTrade) continue;

      if(MaxHistory > 0 && count >= MaxHistory) break;

      if(!first) arr += ",";
      first = false;
      count++;

      datetime closeTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      datetime openTime  = closeTime; // MT5 deals don't carry original open time; use deal time
      string   sym       = HistoryDealGetString(ticket, DEAL_SYMBOL);
      double   lots      = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double   price     = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double   profit    = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      double   commission= HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      double   swap      = HistoryDealGetDouble(ticket, DEAL_SWAP);
      string   comment   = HistoryDealGetString(ticket, DEAL_COMMENT);

      arr += "{";
      arr += "\"ticket\":"      + IntegerToString(ticket);
      arr += ",\"symbol\":\""   + EscapeJson(sym) + "\"";
      arr += ",\"type\":\""     + DealTypeToStr(dt) + "\"";
      arr += ",\"lots\":"       + SafeNum(lots,       2);
      arr += ",\"openPrice\":"  + SafeNum(price,      5);
      arr += ",\"closePrice\":" + SafeNum(price,      5);  // MT5 deal has single price
      arr += ",\"stopLoss\":"   + "0";
      arr += ",\"takeProfit\":" + "0";
      arr += ",\"profit\":"     + SafeNum(profit,     2);
      arr += ",\"commission\":" + SafeNum(commission, 2);
      arr += ",\"swap\":"       + SafeNum(swap,       2);
      arr += ",\"openTime\":"   + IntegerToString(openTime);
      arr += ",\"closeTime\":"  + IntegerToString(closeTime);
      arr += ",\"comment\":\""  + EscapeJson(comment) + "\"";
      arr += "}";
   }
   arr += "]";
   return arr;
}

//+------------------------------------------------------------------+
//| Helper: deal type ke string                                       |
//+------------------------------------------------------------------+
string DealTypeToStr(ENUM_DEAL_TYPE dt)
{
   switch(dt)
   {
      case DEAL_TYPE_BUY:     return "BUY";
      case DEAL_TYPE_SELL:    return "SELL";
      case DEAL_TYPE_BALANCE: return "BALANCE";
      case DEAL_TYPE_CREDIT:  return "CREDIT";
      default:                return "UNKNOWN";
   }
}

//+------------------------------------------------------------------+
//| Helper: escape JSON string — ASCII printable only                 |
//+------------------------------------------------------------------+
string EscapeJson(string s)
{
   string result = "";
   int len = StringLen(s);
   for(int i = 0; i < len; i++)
   {
      ushort c = StringGetCharacter(s, i);   // MT5: StringGetCharacter (not StringGetChar)
      if(c == 0x22) { result += "\\\""; continue; }   // "
      if(c == 0x5C) { result += "\\\\"; continue; }   // backslash
      if(c >= 0x20 && c <= 0x7E) { result += ShortToString(c); continue; }
      // strip non-printable / non-ASCII
   }
   return result;
}

//+------------------------------------------------------------------+
//| Helper: safe number to string — replaces nan/inf with 0          |
//+------------------------------------------------------------------+
string SafeNum(double v, int digits)
{
   if(!MathIsValidNumber(v)) return "0";
   return DoubleToString(v, digits);
}
