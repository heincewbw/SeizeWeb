//+------------------------------------------------------------------+
//|  AceCapitalBridgeMT5.mq5                                         |
//|  MT5 Bridge Expert Advisor for AceCapital Platform               |
//|                                                                   |
//|  SETUP:                                                           |
//|  1. Copy ke: MetaTrader5/MQL5/Experts/AceCapitalBridgeMT5.mq5   |
//|  2. Compile di MetaEditor (F7)                                    |
//|  3. Set ServerUrl = URL Railway kamu                              |
//|  4. Set EaSecret  = nilai EA_SECRET dari Railway environment      |
//|  5. Kosongkan BridgeToken (biarkan "" — akan di-fetch otomatis)  |
//|  6. Drag ke chart mana saja                                       |
//|  7. Enable "Allow live trading" & tambahkan ServerUrl ke          |
//|     Tools > Options > Expert Advisors > Allow WebRequest          |
//+------------------------------------------------------------------+
#property copyright "AceCapital"
#property version   "1.0"

#define EA_VERSION "1.0"

input string ServerUrl    = "https://acecapital.id"; // Backend server URL
input string EaSecret     = "12b2d69d4c2cc90248664926b04579872cb28a60f5cd8223";                       // EA_SECRET dari Railway env
input string BridgeToken  = "";                       // Bridge token manual (kosongkan jika pakai EaSecret)
input int    PushInterval = 300;                      // Push interval in seconds
input bool   PushHistory  = true;                     // Send trade history
input int    MaxHistory   = 500;                      // Max history trades to send (0 = unlimited)
input int    HistoryDays  = 90;                       // How many days back to send on first push

// Global state
datetime gLastPush        = 0;
datetime gLastHistorySent = 0;
string   gActiveToken     = "";
bool     gTokenPending    = false;
bool     inProgress       = false;

string GV_TOKEN_KEY = "";

//+------------------------------------------------------------------+
//| OnInit                                                           |
//+------------------------------------------------------------------+
int OnInit()
{
   GV_TOKEN_KEY = "AceCapitalBridgeToken_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "_" + AccountInfoString(ACCOUNT_SERVER);

   if(StringLen(BridgeToken) > 0)
   {
      gActiveToken = BridgeToken;
      Print("[AceCapitalBridge] Mode manual. Token dari input parameter.");
   }
   else
   {
      string cached = ReadTokenFile();
      if(StringLen(cached) >= 32)
      {
         gActiveToken = cached;
         Print("[AceCapitalBridge] Token di-load dari cache. Login=", AccountInfoInteger(ACCOUNT_LOGIN));
      }
   }

   if(StringLen(gActiveToken) == 0)
   {
      if(StringLen(EaSecret) == 0)
      {
         Alert("[AceCapitalBridge] Isi BridgeToken ATAU EaSecret!");
         return(INIT_FAILED);
      }
      Print("[AceCapitalBridge] Mengambil token otomatis dari server...");
      gActiveToken = FetchToken();
      if(StringLen(gActiveToken) == 0)
      {
         gTokenPending = true;
         Print("[AceCapitalBridge] Token belum didapat, akan retry setiap ", PushInterval, " detik...");
      }
      else
      {
         WriteTokenFile(gActiveToken);
         Print("[AceCapitalBridge] Token berhasil di-fetch dan di-cache. Login=", AccountInfoInteger(ACCOUNT_LOGIN));
      }
   }

   Print("[AceCapitalBridge] Mulai. Server=", ServerUrl, " Login=", AccountInfoInteger(ACCOUNT_LOGIN));
   EventSetTimer(PushInterval);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| OnDeinit                                                         |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[AceCapitalBridge] Berhenti. Reason=", reason);
}

//+------------------------------------------------------------------+
//| OnTimer                                                          |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(inProgress) return;
   inProgress = true;
   inProgress = false;
   gLastPush = 0;
   OnTick();
}

//+------------------------------------------------------------------+
//| OnTick                                                           |
//+------------------------------------------------------------------+
void OnTick()
{
   if(gTokenPending)
   {
      Print("[AceCapitalBridge] Retry mengambil token...");
      string t = FetchToken();
      if(StringLen(t) > 0)
      {
         gActiveToken  = t;
         gTokenPending = false;
         WriteTokenFile(gActiveToken);
         Print("[AceCapitalBridge] Token berhasil didapat setelah retry. Login=", AccountInfoInteger(ACCOUNT_LOGIN));
      }
      else
      {
         Print("[AceCapitalBridge] Retry token gagal, coba lagi nanti...");
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
      histJson         = BuildHistoryJson(fromTime);
      gLastHistorySent = TimeLocal();
   }

   string login  = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string server = AccountInfoString(ACCOUNT_SERVER);

   string payload = "{";
   payload += "\"token\":\""       + gActiveToken + "\"";
   payload += ",\"login\":\""      + login + "\"";
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
}

//+------------------------------------------------------------------+
//| Auto-fetch token via ea-autoregister                             |
//+------------------------------------------------------------------+
string FetchToken()
{
   string url     = ServerUrl + "/api/mt4/ea-autoregister";
   string headers = "Content-Type: application/json\r\n";
   char   postData[];
   char   resultData[];
   string resultHeaders;

   string login   = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string server  = AccountInfoString(ACCOUNT_SERVER);
   string payload = "{\"ea_secret\":\"" + EaSecret + "\",\"login\":\"" + login + "\",\"server\":\"" + EscapeJson(server) + "\"}";

   StringToCharArray(payload, postData, 0, StringLen(payload));

   int res = WebRequest("POST", url, headers, 10000, postData, resultData, resultHeaders);
   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Alert("[AceCapitalBridge] URL belum di-whitelist! Tambahkan '" + ServerUrl + "' di MT5: Tools > Options > Expert Advisors > Allow WebRequest. Lalu RESTART MT5.");
      else
         Alert("[AceCapitalBridge] WebRequest gagal! Error code: " + IntegerToString(err));
      Print("[AceCapitalBridge] FetchToken error=", err);
      return("");
   }
   if(res != 200)
   {
      string body = CharArrayToString(resultData);
      Print("[AceCapitalBridge] FetchToken gagal. HTTP=", res, " Body=", body);
      return("");
   }

   string body = CharArrayToString(resultData);
   int idx = StringFind(body, "\"bridge_token\":\"");
   if(idx < 0) { Print("[AceCapitalBridge] bridge_token tidak ditemukan dalam response"); return(""); }
   idx += 16;
   int end = StringFind(body, "\"", idx);
   if(end < 0) return("");
   return StringSubstr(body, idx, end - idx);
}

//+------------------------------------------------------------------+
//| Token file cache                                                 |
//+------------------------------------------------------------------+
void WriteTokenFile(string token)
{
   string fname = "AceCapitalBridge_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "_" + AccountInfoString(ACCOUNT_SERVER) + ".tkn";
   int h = FileOpen(fname, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(h != INVALID_HANDLE) { FileWriteString(h, token); FileClose(h); }
}

string ReadTokenFile()
{
   string fname = "AceCapitalBridge_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "_" + AccountInfoString(ACCOUNT_SERVER) + ".tkn";
   if(!FileIsExist(fname)) return("");
   int h = FileOpen(fname, FILE_READ | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE) return("");
   string token = FileReadString(h);
   FileClose(h);
   return token;
}

//+------------------------------------------------------------------+
//| HTTP POST ke backend                                             |
//+------------------------------------------------------------------+
void SendPush(string payload)
{
   string url     = ServerUrl + "/api/mt4/push";
   string headers = "Content-Type: application/json\r\n";
   char   postData[];
   char   resultData[];
   string resultHeaders;

   StringToCharArray(payload, postData, 0, StringLen(payload));

   int res = WebRequest("POST", url, headers, 5000, postData, resultData, resultHeaders);

   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Print("[AceCapitalBridge] URL belum di-whitelist! Tambahkan '", ServerUrl,
               "' di MT5: Tools > Options > Expert Advisors > Allow WebRequest.");
      else
         Print("[AceCapitalBridge] WebRequest gagal. Error=", err);
      return;
   }

   if(res != 200)
   {
      Print("[AceCapitalBridge] Push gagal. HTTP=", res,
            " Response=", CharArrayToString(resultData));
      return;
   }

   Print("[AceCapitalBridge] Push OK. Positions=", PositionsTotal());
}

//+------------------------------------------------------------------+
//| Build JSON array open positions (MT5 uses PositionGetXxx)        |
//+------------------------------------------------------------------+
string BuildPositionsJson()
{
   string arr  = "[";
   bool   first = true;

   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;

      string symbol = PositionGetString(POSITION_SYMBOL);
      long   type   = PositionGetInteger(POSITION_TYPE); // 0=BUY, 1=SELL

      double curPrice = (type == POSITION_TYPE_BUY)
                        ? SymbolInfoDouble(symbol, SYMBOL_BID)
                        : SymbolInfoDouble(symbol, SYMBOL_ASK);

      if(!first) arr += ",";
      first = false;

      arr += "{";
      arr += "\"ticket\":"        + IntegerToString(ticket);
      arr += ",\"symbol\":\""     + EscapeJson(symbol) + "\"";
      arr += ",\"type\":\""       + (type == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\"";
      arr += ",\"lots\":"         + SafeNum(PositionGetDouble(POSITION_VOLUME),      2);
      arr += ",\"openPrice\":"    + SafeNum(PositionGetDouble(POSITION_PRICE_OPEN),  5);
      arr += ",\"currentPrice\":" + SafeNum(curPrice,                                5);
      arr += ",\"stopLoss\":"     + SafeNum(PositionGetDouble(POSITION_SL),          5);
      arr += ",\"takeProfit\":"   + SafeNum(PositionGetDouble(POSITION_TP),          5);
      arr += ",\"profit\":"       + SafeNum(PositionGetDouble(POSITION_PROFIT),      2);
      arr += ",\"swap\":"         + SafeNum(PositionGetDouble(POSITION_SWAP),        2);
      arr += ",\"openTime\":"     + IntegerToString(PositionGetInteger(POSITION_TIME));
      arr += ",\"comment\":\"\"";
      arr += "}";
   }
   arr += "]";
   return arr;
}

//+------------------------------------------------------------------+
//| Build JSON array trade history (MT5 uses HistoryDeal)            |
//+------------------------------------------------------------------+
string BuildHistoryJson(datetime fromTime)
{
   // Request history range
   HistorySelect(fromTime, TimeCurrent() + 86400);

   string arr  = "[";
   bool   first = true;
   int    count = 0;

   int total = HistoryDealsTotal();
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;

      long dealType  = HistoryDealGetInteger(ticket, DEAL_TYPE);
      long dealEntry = HistoryDealGetInteger(ticket, DEAL_ENTRY);

      // Only OUT (closed) deals, BUY/SELL, and BALANCE (type=2)
      bool isTrade   = (dealType == DEAL_TYPE_BUY || dealType == DEAL_TYPE_SELL) && dealEntry == DEAL_ENTRY_OUT;
      bool isBalance = (dealType == DEAL_TYPE_BALANCE);
      if(!isTrade && !isBalance) continue;

      datetime closeTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      if(closeTime < fromTime) continue;

      if(MaxHistory > 0 && count >= MaxHistory) break;
      if(!first) arr += ",";
      first = false;
      count++;

      string typeStr = isBalance ? "BALANCE" : (dealType == DEAL_TYPE_BUY ? "BUY" : "SELL");
      string symbol  = HistoryDealGetString(ticket, DEAL_SYMBOL);

      // For closed deals, position ticket is the order ticket (used as unique ID)
      ulong posTicket = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);

      arr += "{";
      arr += "\"ticket\":"      + IntegerToString(posTicket > 0 ? posTicket : ticket);
      arr += ",\"symbol\":\""   + EscapeJson(symbol) + "\"";
      arr += ",\"type\":\""     + typeStr + "\"";
      arr += ",\"lots\":"       + SafeNum(HistoryDealGetDouble(ticket, DEAL_VOLUME),     2);
      arr += ",\"openPrice\":"  + SafeNum(HistoryDealGetDouble(ticket, DEAL_PRICE),      5);
      arr += ",\"closePrice\":" + SafeNum(HistoryDealGetDouble(ticket, DEAL_PRICE),      5);
      arr += ",\"stopLoss\":"   + "0";
      arr += ",\"takeProfit\":" + "0";
      arr += ",\"profit\":"     + SafeNum(HistoryDealGetDouble(ticket, DEAL_PROFIT),     2);
      arr += ",\"commission\":" + SafeNum(HistoryDealGetDouble(ticket, DEAL_COMMISSION), 2);
      arr += ",\"swap\":"       + SafeNum(HistoryDealGetDouble(ticket, DEAL_SWAP),       2);
      arr += ",\"openTime\":"   + IntegerToString(closeTime);
      arr += ",\"closeTime\":"  + IntegerToString(closeTime);
      arr += ",\"comment\":\""  + EscapeJson(HistoryDealGetString(ticket, DEAL_COMMENT)) + "\"";
      arr += "}";
   }
   arr += "]";
   return arr;
}

//+------------------------------------------------------------------+
//| Helper: escape JSON string                                       |
//+------------------------------------------------------------------+
string EscapeJson(string s)
{
   string result = "";
   int len = StringLen(s);
   for(int i = 0; i < len; i++)
   {
      ushort c = StringGetCharacter(s, i);
      if(c == 0x22) { result += "\\\""; continue; }
      if(c == 0x5C) { result += "\\\\"; continue; }
      if(c >= 0x20 && c <= 0x7E) { result += ShortToString(c); continue; }
   }
   return result;
}

//+------------------------------------------------------------------+
//| Helper: safe number to string                                    |
//+------------------------------------------------------------------+
string SafeNum(double v, int digits)
{
   if(!MathIsValidNumber(v)) return "0";
   return DoubleToString(v, digits);
}
