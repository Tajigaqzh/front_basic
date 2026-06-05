<template>
  <div>
    <div>
      {{pageData}}
    </div>
  </div>
</template>


<script setup lang="ts">



import {reactive} from "vue";

let pageData = reactive({
  name:"张三",
  age:10
})


const changeReactiveData = () => {
  pageData = reactive({
    name:"李四",
    age: 20
  });

}


</script>