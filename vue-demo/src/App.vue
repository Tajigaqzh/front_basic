<template>
  <input @keyup.[1]="test">
</template>


<script setup lang="ts">



import {reactive} from "vue";

let pageData = reactive({
  name:"张三",
  age:10
})


const changeReactiveData = () => {


}


</script>