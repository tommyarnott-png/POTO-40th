import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";

// The archive is a single page, so there is no router. Theme is fixed to the
// official dark palette defined in index.css rather than being switchable.
function App() {
  return (
    <ErrorBoundary>
      <Home />
    </ErrorBoundary>
  );
}

export default App;
