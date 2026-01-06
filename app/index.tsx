import DateTimePicker from "@react-native-community/datetimepicker";
import * as Notifications from "expo-notifications";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/* ---------------- OPEN DATABASE ---------------- */
const db = SQLite.openDatabaseSync("todos.db");

/* ---------------- NOTIFICATION HANDLER ---------------- */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Filter = "all" | "completed" | "pending";

export default function App() {
  const [task, setTask] = useState("");
  const [due, setDue] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [todos, setTodos] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  /* ---------------- CREATE TABLE ---------------- */
  useEffect(() => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            completed INTEGER,
            due_time TEXT
          );`
        );
      },
      (error) => console.log("DB ERROR:", error),
      () => fetchTodos()
    );
    Notifications.requestPermissionsAsync();
  }, []);

  /* ---------------- FETCH TODOS ---------------- */
  const fetchTodos = () => {
    db.transaction((tx) => {
      tx.executeSql(
        "SELECT * FROM todos ORDER BY id DESC;",
        [],
        (_, { rows }) => setTodos(rows._array)
      );
    });
  };

  /* ---------------- ADD TODO ---------------- */
  const addTodo = async () => {
    if (!task.trim()) {
      Alert.alert("Error", "Enter task name");
      return;
    }

    const date = due;

    db.transaction(
      (tx) => {
        tx.executeSql(
          "INSERT INTO todos (title, completed, due_time) VALUES (?, ?, ?);",
          [task.trim(), 0, date.toISOString()],
          () => fetchTodos()
        );
      },
      (error) => console.log("Insert Error:", error)
    );

    if (Platform.OS !== "web") {
      const seconds = Math.max(Math.floor((date.getTime() - Date.now()) / 1000), 1);
      await Notifications.scheduleNotificationAsync({
        content: { title: "Todo Reminder", body: task.trim() },
        trigger: { type: "timeInterval", seconds, repeats: false } as Notifications.TimeIntervalTriggerInput,
      });
    }

    setTask("");
    setDue(new Date());
  };

  /* ---------------- TOGGLE COMPLETE ---------------- */
  const toggleTodo = (id: number, completed: number) => {
    db.transaction((tx) => {
      tx.executeSql(
        "UPDATE todos SET completed = ? WHERE id = ?;",
        [completed ? 0 : 1, id],
        () => fetchTodos()
      );
    });
  };

  /* ---------------- DELETE TODO ---------------- */
  const deleteTodo = (id: number) => {
    db.transaction((tx) => {
      tx.executeSql("DELETE FROM todos WHERE id = ?;", [id], () => fetchTodos());
    });
  };

  /* ---------------- TIME OVER CHECK ---------------- */
  const isTimeOver = (dueTime: string) => new Date(dueTime).getTime() < Date.now();

  /* ---------------- FILTERED TODOS ---------------- */
  const filteredTodos = todos.filter((t) => {
    if (filter === "all") return true;
    if (filter === "completed") return t.completed === 1;
    if (filter === "pending") return t.completed === 0;
    return true;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Todo App (SQLite)</Text>

      <TextInput
        style={styles.input}
        placeholder="Task name"
        value={task}
        onChangeText={setTask}
      />

      <Button title={`Pick Due Time: ${due.toLocaleString()}`} onPress={() => setShowPicker(true)} />
      {showPicker && (
        <DateTimePicker
          value={due}
          mode="datetime"
          display="default"
          onChange={(_, selectedDate) => {
            setShowPicker(false);
            if (selectedDate) setDue(selectedDate);
          }}
        />
      )}

      <Button title="Add Task" onPress={addTodo} />

      {/* FILTER BUTTONS */}
      <View style={styles.filters}>
        {(["all", "completed", "pending"] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f ? styles.filterActive : {}]}
            onPress={() => setFilter(f)}
          >
            <Text style={styles.filterText}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredTodos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.todo}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.text, item.completed ? styles.completed : {}]}>
                {item.title}
              </Text>
              <Text style={styles.time}>⏰ {new Date(item.due_time).toLocaleString()}</Text>
              {!item.completed && isTimeOver(item.due_time) && (
                <Text style={styles.over}>⛔ Time Over</Text>
              )}
            </View>

            <Button
              title={item.completed ? "Undo" : "Done"}
              onPress={() => toggleTodo(item.id, item.completed)}
            />

            <Button
              title="Del"
              color="red"
              onPress={() => deleteTodo(item.id)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, marginTop: 40 },
  heading: { fontSize: 24, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  input: { borderWidth: 1, padding: 10, marginBottom: 8, borderRadius: 5 },
  todo: { flexDirection: "row", marginVertical: 8, alignItems: "center" },
  text: { fontSize: 16 },
  completed: { textDecorationLine: "line-through", color: "gray" },
  time: { fontSize: 12, color: "gray" },
  over: { color: "red", fontWeight: "bold" },
  filters: { flexDirection: "row", justifyContent: "space-around", marginVertical: 10 },
  filterBtn: { padding: 8, borderWidth: 1, borderRadius: 5 },
  filterActive: { backgroundColor: "#4CAF50", borderColor: "#4CAF50" },
  filterText: { color: "#000", fontWeight: "bold" },
});
