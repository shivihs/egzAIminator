import { Route, Switch } from "wouter";
import Home from "./pages/Home";
import Egzaminator from "./pages/Egzaminator";

function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/egzaminator" component={Egzaminator} />
      <Route>404 - Nie znaleziono strony</Route>
    </Switch>
  );
}

export default App;
