// components/RatingComponent.js
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export default function RatingComponent({ rating, onRate }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onRate(star)}>
          <Text style={{ fontSize: 30, color: star <= rating ? "gold" : "gray" }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
