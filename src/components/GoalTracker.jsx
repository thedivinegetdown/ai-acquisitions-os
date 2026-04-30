const GoalTracker = ({ deals }) => {
  return (
    <div style={{ padding: 16 }}>
      <h2>KPI Goal Tracker</h2>
      <p>Total Deals: {deals.length}</p>
    </div>
  );
};

export default GoalTracker;