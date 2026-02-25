import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";

const API = "https://api.flightradar24.com/common/v1/airport.json";

function App() {
  const [currentCode, setCurrentCode] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState("departures");
  const [departures, setDepartures] = useState([]);
  const [arrivals, setArrivals] = useState([]);
  const [groundData, setGroundData] = useState(null);
  const [loading, setLoading] = useState({ departures: false, arrivals: false, ground: false });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const countdownRef = useRef(null);

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const loadDepartures = useCallback(async (code) => {
    const url = `${API}?code=${code}&plugin[]=schedule&plugin-setting[schedule][mode]=departures`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json?.result?.response?.airport?.pluginData?.schedule?.departures?.data || [];
    } catch {
      return [];
    }
  }, []);

  const loadArrivals = useCallback(async (code) => {
    const url = `${API}?code=${code}&plugin[]=schedule&plugin-setting[schedule][mode]=arrivals`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json?.result?.response?.airport?.pluginData?.schedule?.arrivals?.data || [];
    } catch {
      return [];
    }
  }, []);

  const loadGround = useCallback(async (code) => {
    const url = `${API}?code=${code}&plugin[]=schedule`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json?.result?.response?.airport?.pluginData?.aircraftCount || null;
    } catch {
      return null;
    }
  }, []);

  const loadAirportData = useCallback(async (code, showLoadingState = true) => {
    if (showLoadingState) {
      setLoading({ departures: true, arrivals: true, ground: true });
    }

    try {
      const [depData, arrData, gndData] = await Promise.all([
        loadDepartures(code),
        loadArrivals(code),
        loadGround(code)
      ]);

      setDepartures(depData);
      setArrivals(arrData);
      setGroundData(gndData);
    } catch (err) {
      console.error(err);
      showToastMessage("Request failed - likely CORS restriction from FlightRadar24");
    } finally {
      setLoading({ departures: false, arrivals: false, ground: false });
    }
  }, [loadDepartures, loadArrivals, loadGround]);

  const handleLoad = () => {
    const code = inputValue.trim().toUpperCase();
    if (code.length !== 3) {
      showToastMessage("Please enter a valid 3-letter IATA code");
      return;
    }
    setCurrentCode(code);
    setCountdown(60);
    loadAirportData(code, true);
  };

  const quickLoad = (code) => {
    setInputValue(code);
    setCurrentCode(code);
    setCountdown(60);
    loadAirportData(code, true);
  };

  // Auto-refresh countdown
  useEffect(() => {
    if (autoRefresh && currentCode) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            loadAirportData(currentCode, false);
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [autoRefresh, currentCode, loadAirportData]);

  const getStatusClass = (status) => {
    const s = status.toLowerCase();
    if (s.includes("scheduled") || s.includes("on time") || s.includes("landed") || s.includes("arrived")) {
      return "status-scheduled";
    }
    if (s.includes("delayed") || s.includes("late")) {
      return "status-delayed";
    }
    if (s.includes("cancelled") || s.includes("diverted")) {
      return "status-cancelled";
    }
    if (s.includes("en route") || s.includes("airborne") || s.includes("taxiing") || s.includes("boarding")) {
      return "status-en-route";
    }
    return "status-unknown";
  };

  const FlightTable = ({ flights, type }) => {
    if (flights.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">
            <i className="fas fa-plane-slash"></i>
          </div>
          <h3 className="empty-title">No Flights Found</h3>
          <p className="empty-text">No {type === "departure" ? "departures" : "arrivals"} scheduled at this time</p>
        </div>
      );
    }

    return (
      <table>
        <thead>
          <tr>
            <th>Flight</th>
            <th>Airline</th>
            <th>{type === "arrival" ? "From" : "To"}</th>
            <th>Aircraft</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((entry, index) => {
            const f = entry.flight;
            const flightNo = f.identification?.number?.default || f.identification?.callsign || "—";
            const airline = f.airline?.short || f.airline?.name || f.owner?.name || "—";
            const airlineCode = airline.substring(0, 2).toUpperCase();
            const airport = type === "arrival" ? f.airport?.origin?.code?.iata : f.airport?.destination?.code?.iata;
            const aircraft = f.aircraft?.registration || "—";
            const status = f.status?.text || "—";
            const statusClass = getStatusClass(status);

            return (
              <tr key={index} style={{ animationDelay: `${index * 0.05}s` }}>
                <td><span className="flight-number">{flightNo}</span></td>
                <td>
                  <div className="airline-cell">
                    <div className="airline-logo">{airlineCode}</div>
                    <span>{airline}</span>
                  </div>
                </td>
                <td><span className="airport-code">{airport || "—"}</span></td>
                <td><span className="aircraft-reg">{aircraft}</span></td>
                <td>
                  <span className={`status-badge ${statusClass}`}>
                    <span className="status-dot"></span>
                    {status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const LoadingState = () => (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p className="loading-text">Loading flight data...</p>
    </div>
  );

  const InitialState = () => (
    <div className="initial-state">
      <div className="initial-icon">
        <i className="fas fa-globe-americas"></i>
      </div>
      <h2 className="initial-title">Search for an Airport</h2>
      <p className="initial-text">Enter a 3-letter IATA code above to view real-time flight information</p>
      <div className="popular-airports">
        {["JFK", "LAX", "LHR", "SYD", "DXB", "SIN", "NRT"].map((code) => (
          <button key={code} className="popular-btn" onClick={() => quickLoad(code)} data-testid={`quick-load-${code}`}>
            {code}
          </button>
        ))}
      </div>
    </div>
  );

  const GroundStats = () => {
    if (!groundData) {
      return (
        <div className="empty-state">
          <div className="empty-icon">
            <i className="fas fa-parking"></i>
          </div>
          <h3 className="empty-title">No Ground Data</h3>
          <p className="empty-text">No aircraft ground data available</p>
        </div>
      );
    }

    return (
      <div className="ground-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-plane"></i>
          </div>
          <div className="stat-value">{groundData.onGround?.total || 0}</div>
          <div className="stat-label">Total on Ground</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-eye"></i>
          </div>
          <div className="stat-value">{groundData.onGround?.visible || 0}</div>
          <div className="stat-label">Visible Aircraft</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-parking"></i>
          </div>
          <div className="stat-value">{groundData.ground || 0}</div>
          <div className="stat-label">Parked</div>
        </div>
      </div>
    );
  };

  return (
    <div className="flight-app">
      <div className="bg-gradient"></div>

      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="logo-section">
            <div className="logo-icon">
              <i className="fas fa-plane"></i>
            </div>
            <div className="logo-text">
              <h1>Flight Board</h1>
              <p>Real-time airport flight information</p>
            </div>
          </div>
          {currentCode && (
            <div className="live-indicator" data-testid="live-indicator">
              <span className="live-dot"></span>
              <span>Live Data</span>
              {autoRefresh && <span className="refresh-timer">({countdown}s)</span>}
            </div>
          )}
        </header>

        {/* Search Section */}
        <section className="search-section">
          <div className="search-row">
            <div className="input-wrapper">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === "Enter" && handleLoad()}
                placeholder="Enter IATA code"
                maxLength={3}
                autoComplete="off"
                data-testid="airport-input"
              />
              <i className="fas fa-search"></i>
            </div>
            <button className="btn btn-primary" onClick={handleLoad} data-testid="load-button">
              <i className="fas fa-plane-departure"></i>
              Load Airport
            </button>
            <div className="auto-refresh-toggle">
              <span>Auto Refresh</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  data-testid="auto-refresh-toggle"
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="tabs-container">
          <button
            className={`tab ${activeTab === "departures" ? "active" : ""}`}
            onClick={() => setActiveTab("departures")}
            data-testid="departures-tab"
          >
            <i className="fas fa-plane-departure"></i>
            Departures
            <span className="tab-count">{departures.length}</span>
          </button>
          <button
            className={`tab ${activeTab === "arrivals" ? "active" : ""}`}
            onClick={() => setActiveTab("arrivals")}
            data-testid="arrivals-tab"
          >
            <i className="fas fa-plane-arrival"></i>
            Arrivals
            <span className="tab-count">{arrivals.length}</span>
          </button>
          <button
            className={`tab ${activeTab === "ground" ? "active" : ""}`}
            onClick={() => setActiveTab("ground")}
            data-testid="ground-tab"
          >
            <i className="fas fa-parking"></i>
            On Ground
          </button>
        </div>

        {/* Panels */}
        <div className="table-container">
          {activeTab === "departures" && (
            <div className="panel" data-testid="departures-panel">
              {!currentCode ? (
                <InitialState />
              ) : loading.departures ? (
                <LoadingState />
              ) : (
                <FlightTable flights={departures} type="departure" />
              )}
            </div>
          )}

          {activeTab === "arrivals" && (
            <div className="panel" data-testid="arrivals-panel">
              {!currentCode ? (
                <InitialState />
              ) : loading.arrivals ? (
                <LoadingState />
              ) : (
                <FlightTable flights={arrivals} type="arrival" />
              )}
            </div>
          )}

          {activeTab === "ground" && (
            <div className="panel" data-testid="ground-panel">
              {!currentCode ? (
                <InitialState />
              ) : loading.ground ? (
                <LoadingState />
              ) : (
                <GroundStats />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      <div className={`toast ${showToast ? "show" : ""}`} data-testid="toast">
        <i className="fas fa-exclamation-circle"></i>
        <span>{toastMessage}</span>
      </div>
    </div>
  );
}

export default App;
